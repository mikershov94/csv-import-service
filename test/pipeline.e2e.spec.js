const fs = require('node:fs');
const readline = require('node:readline');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { spawnSync } = require('node:child_process');
const { MongoClient, ObjectId } = require('mongodb');
const amqp = require('amqplib');

const IMPORT_QUEUE_NAME = 'imports.queue';
const FINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed']);
const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');

const TEST_MONGODB_URI =
    process.env.TEST_MONGODB_URI ??
    'mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin';
const TEST_RABBITMQ_URL = process.env.TEST_RABBITMQ_URL ?? 'amqp://admin:Asdqwe123!@localhost:5672';
const TEST_BACKEND_BASE_URL = process.env.TEST_BACKEND_BASE_URL ?? 'http://localhost:8000';

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: false,
            ...options,
        });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 180_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {}
        await sleep(500);
    }
    throw new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`);
}

async function waitForRabbit(url, timeoutMs = 120_000) {
    const startedAt = Date.now();
    let lastError;

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const connection = await amqp.connect(url);
            await connection.close();
            return;
        } catch (error) {
            lastError = error;
            await sleep(500);
        }
    }

    const details = lastError instanceof Error ? lastError.message : 'unknown error';
    throw new Error(`Timeout waiting for RabbitMQ (${url}): ${details}`);
}

function generateCsv({ mode, rows, outPath }) {
    const scriptPath = path.resolve(__dirname, '../scripts/generate-import-csv.js');
    const args = [scriptPath, '--mode', mode, '--rows', String(rows), '--out', outPath];
    if (mode === 'mixed') {
        args.push('--invalid-rate', '0.2');
    }

    const result = spawnSync('node', args, { stdio: 'inherit' });
    if (result.status !== 0) {
        throw new Error(`CSV generator failed for mode=${mode}`);
    }
}

async function createImport(csvPath) {
    const csvBuffer = fs.readFileSync(csvPath);
    const form = new FormData();
    form.append('file', new Blob([csvBuffer], { type: 'text/csv' }), path.basename(csvPath));

    const response = await fetch(`${TEST_BACKEND_BASE_URL}/api/imports`, {
        method: 'POST',
        body: form,
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`POST /api/imports failed: ${response.status} ${JSON.stringify(body)}`);
    }
    return body.jobId;
}

async function waitForImportCompletion(jobId, timeoutMs = 120_000) {
    const startedAt = Date.now();
    let lastKnownStatus = 'unknown';
    let attempts = 0;
    while (Date.now() - startedAt < timeoutMs) {
        const response = await fetch(`${TEST_BACKEND_BASE_URL}/api/imports/${jobId}`);
        if (response.ok) {
            const body = await response.json();
            attempts += 1;
            if (typeof body.status === 'string') {
                lastKnownStatus = body.status;
            }
            if (attempts % 10 === 0) {
                // eslint-disable-next-line no-console
                console.log(`[pipeline-e2e] job ${jobId} status: ${lastKnownStatus}`);
            }
            if (FINAL_STATUSES.has(body.status)) {
                return body;
            }
        }
        await sleep(500);
    }
    throw new Error(
        `Import ${jobId} did not complete in ${timeoutMs}ms. Last status: ${lastKnownStatus}`,
    );
}

async function countCsvDataRows(csvPath) {
    const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });
    const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let linesCount = 0;
    for await (const _line of lineReader) {
        linesCount += 1;
    }

    // first line is header, empty file is treated as 0 data rows
    return Math.max(0, linesCount - 1);
}

describe('Pipeline e2e', () => {
    jest.setTimeout(300_000);

    let mongo;
    let db;
    let rabbitConnection;
    let rabbitChannel;

    async function clearState() {
        await db.collection('imports').deleteMany({});
        await db.collection('cars').deleteMany({});
        await rabbitChannel.purgeQueue(IMPORT_QUEUE_NAME);
    }

    beforeAll(async () => {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        await run('docker', [
            'compose',
            'up',
            '-d',
            'mongodb',
            'rabbitmq',
            'backend',
            'worker',
        ]);
        await waitForHttp(`${TEST_BACKEND_BASE_URL}/api/health`);
        await waitForRabbit(TEST_RABBITMQ_URL);

        mongo = new MongoClient(TEST_MONGODB_URI);
        await mongo.connect();
        db = mongo.db();

        rabbitConnection = await amqp.connect(TEST_RABBITMQ_URL);
        rabbitChannel = await rabbitConnection.createChannel();
        await rabbitChannel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
        await clearState();
    });

    afterAll(async () => {
        if (db && rabbitChannel) {
            await clearState();
        }
        await rabbitChannel?.close();
        await rabbitConnection?.close();
        await mongo?.close();
        await run('docker', ['compose', 'down']);
    });

    beforeEach(async () => {
        await clearState();
    });

    it('happy-path: import завершается completed без ошибок', async () => {
        const csvPath = path.join(ARTIFACTS_DIR, 'pipeline-happy.csv');
        generateCsv({ mode: 'happy', rows: 30, outPath: csvPath });

        const jobId = await createImport(csvPath);
        const importDetails = await waitForImportCompletion(jobId);
        const importDoc = await db.collection('imports').findOne({ _id: new ObjectId(jobId) });

        expect(importDetails.status).toBe('completed');
        expect(importDetails.failedRows).toBe(0);
        expect(importDetails.successRows).toBeGreaterThan(0);
        expect(importDoc?.errorSummary).toHaveLength(0);
    });

    it('mixed: import завершается completed_with_errors и пишет errorSummary', async () => {
        const csvPath = path.join(ARTIFACTS_DIR, 'pipeline-mixed.csv');
        generateCsv({ mode: 'mixed', rows: 40, outPath: csvPath });

        const jobId = await createImport(csvPath);
        const importDetails = await waitForImportCompletion(jobId);
        const importDoc = await db.collection('imports').findOne({ _id: new ObjectId(jobId) });

        expect(importDetails.status).toBe('completed_with_errors');
        expect(importDetails.failedRows).toBeGreaterThan(0);
        expect((importDoc?.errorSummary?.length ?? 0) > 0).toBe(true);
    });

    it('idempotency: повторный импорт не создаёт дубликаты cars', async () => {
        const csvPath = path.join(ARTIFACTS_DIR, 'pipeline-idempotency.csv');
        generateCsv({ mode: 'idempotency', rows: 20, outPath: csvPath });

        const firstJobId = await createImport(csvPath);
        const secondJobId = await createImport(csvPath);

        const first = await waitForImportCompletion(firstJobId);
        const second = await waitForImportCompletion(secondJobId);
        const carsCount = await db.collection('cars').countDocuments({});

        expect(first.status).toBe('completed');
        expect(second.status).toBe('completed');
        expect(carsCount).toBeLessThanOrEqual(10);
    });

    it('horizontal scaling: при worker=3 импорт обрабатывается корректно', async () => {
        await run('docker', ['compose', 'up', '-d', '--scale', 'worker=3', 'worker']);
        await waitForRabbit(TEST_RABBITMQ_URL);
        await sleep(1500);

        const csvPath = path.join(ARTIFACTS_DIR, 'pipeline-scaled-happy.csv');
        generateCsv({ mode: 'happy', rows: 10000, outPath: csvPath });

        const jobId = await createImport(csvPath);
        const importDetails = await waitForImportCompletion(jobId, 300_000);
        const importDoc = await db.collection('imports').findOne({ _id: new ObjectId(jobId) });
        const carsCount = await db.collection('cars').countDocuments({});

        expect(importDetails.status).toBe('completed');
        expect(importDetails.processedRows).toBe(10000);
        expect(importDetails.failedRows).toBe(0);
        expect(importDetails.successRows).toBe(10000);
        expect(carsCount).toBe(10000);
        expect(importDoc?.errorSummary).toHaveLength(0);

        await run('docker', ['compose', 'up', '-d', '--scale', 'worker=1', 'worker']);
        await waitForRabbit(TEST_RABBITMQ_URL);
    }, 360_000);

    it('stress: import большого файла pipeline-stress-happy.csv завершается корректно', async () => {
        const csvPath = path.join(ARTIFACTS_DIR, 'pipeline-stress-happy.csv');
        if (!fs.existsSync(csvPath)) {
            throw new Error(
                `Stress file not found: ${csvPath}. Generate it before run (for example via gen:sample).`,
            );
        }

        await run('docker', ['compose', 'up', '-d', '--scale', 'worker=3', 'worker']);
        await waitForRabbit(TEST_RABBITMQ_URL);
        await sleep(2000);

        const expectedRows = await countCsvDataRows(csvPath);
        const jobId = await createImport(csvPath);
        const importDetails = await waitForImportCompletion(jobId, 1_200_000);
        const importDoc = await db.collection('imports').findOne({ _id: new ObjectId(jobId) });
        const carsCount = await db.collection('cars').countDocuments({});

        expect(importDetails.status).toBe('completed');
        expect(importDetails.processedRows).toBe(expectedRows);
        expect(importDetails.successRows).toBe(expectedRows);
        expect(importDetails.failedRows).toBe(0);
        expect(carsCount).toBeGreaterThan(0);
        expect(carsCount).toBeLessThanOrEqual(expectedRows);
        expect(importDoc?.errorSummary).toHaveLength(0);

        await run('docker', ['compose', 'up', '-d', '--scale', 'worker=1', 'worker']);
        await waitForRabbit(TEST_RABBITMQ_URL);
    }, 1_500_000);
});
