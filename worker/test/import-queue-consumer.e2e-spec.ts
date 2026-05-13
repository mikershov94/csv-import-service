import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CarStatus, IMPORT_QUEUE_EVENT_VERSION, IMPORT_QUEUE_EVENTS, ImportStatus } from '@shared';
import { Channel, ChannelModel, connect } from 'amqplib';
import { Model } from 'mongoose';

import { Car, CarDocument } from '../src/cars/entities/car.entity';
import { Import, ImportDocument } from '../src/imports/entities/import.entity';
import { ImportsModule } from '../src/imports/imports.module';

const TEST_MONGO_URI =
    process.env.TEST_MONGODB_URI ??
    'mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin';
const TEST_RABBIT_URI = process.env.TEST_RABBITMQ_URL ?? 'amqp://admin:Asdqwe123%21@localhost:5672';
const IMPORT_QUEUE_NAME = 'imports.queue';
const E2E_TIMEOUT_MS = 60_000;

describe('ImportQueueConsumer (e2e)', () => {
    jest.setTimeout(E2E_TIMEOUT_MS);
    let app: INestApplication;
    let queueConnection: ChannelModel;
    let queueChannel: Channel;
    let importModel: Model<ImportDocument>;
    let carModel: Model<CarDocument>;

    async function bootstrap(): Promise<void> {
        process.env.MONGODB_URI = TEST_MONGO_URI;
        process.env.RABBITMQ_URL = TEST_RABBIT_URI;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(TEST_MONGO_URI), ImportsModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        importModel = app.get<Model<ImportDocument>>(getModelToken(Import.name));
        carModel = app.get<Model<CarDocument>>(getModelToken(Car.name));
    }

    async function waitForImportState(
        jobId: string,
        timeoutMs: number,
        predicate: (importDoc: ImportDocument | null) => boolean,
    ): Promise<ImportDocument> {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            const importDoc = await importModel.findById(jobId).exec();
            if (predicate(importDoc)) {
                if (!importDoc) {
                    throw new Error(`Import ${jobId} не найден`);
                }
                return importDoc;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        throw new Error(`Import ${jobId} не достиг ожидаемого состояния за ${timeoutMs}ms`);
    }

    async function waitForProcessedRows(jobId: string, minProcessedRows: number): Promise<void> {
        await waitForImportState(
            jobId,
            10_000,
            (doc) => (doc?.processedRows ?? 0) >= minProcessedRows,
        );
    }

    function buildValidRow(vin: string, mileage = 10000): string {
        return `${vin},BMW,X5,2020,${mileage},D1,available`;
    }

    function publishEvent(payload: object): void {
        queueChannel.sendToQueue(IMPORT_QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
        });
    }

    beforeAll(async () => {
        queueConnection = await connect(TEST_RABBIT_URI);
        queueChannel = await queueConnection.createChannel();
        await queueChannel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
    });

    beforeEach(async () => {
        await bootstrap();
        await importModel.deleteMany({});
        await carModel.deleteMany({});
        await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
    });

    afterEach(async () => {
        if (importModel) {
            await importModel.deleteMany({});
        }
        if (carModel) {
            await carModel.deleteMany({});
        }
        if (queueChannel) {
            await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
        }
        if (app) {
            await app.close();
        }
    });

    afterAll(async () => {
        if (queueChannel) {
            await queueChannel.close();
        }
        if (queueConnection) {
            await queueConnection.close();
        }
    });

    it('consumer принимает import.job.start из RabbitMQ и помечает import как processing', async () => {
        const createdImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });

        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.JOB_START,
            jobId: createdImport.id,
            fileName: createdImport.fileName,
            fileSizeBytes: createdImport.fileSizeBytes,
        });

        await waitForImportState(
            createdImport.id,
            20_000,
            (importDoc) => importDoc?.status === ImportStatus.PROCESSING,
        );
    });

    it('обрабатывает полный цикл job_start -> chunk -> stream_end и завершает import', async () => {
        const createdImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });

        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.JOB_START,
            jobId: createdImport.id,
            fileName: createdImport.fileName,
            fileSizeBytes: createdImport.fileSizeBytes,
        });
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.CHUNK,
            jobId: createdImport.id,
            chunkIndex: 0,
            isLast: true,
            rowsCount: 1,
            rows: [buildValidRow('1HGCM82633A004352')],
        });
        await waitForProcessedRows(createdImport.id, 1);
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId: createdImport.id,
            totalChunks: 1,
            totalRows: 1,
        });

        const importDoc = await waitForImportState(
            createdImport.id,
            20_000,
            (doc) => doc?.status === ImportStatus.COMPLETED,
        );

        expect(importDoc.status).toBe(ImportStatus.COMPLETED);
        expect(importDoc.processedRows).toBe(1);
        expect(importDoc.successRows).toBe(1);
        expect(importDoc.failedRows).toBe(0);
        expect(importDoc.insertedCount + importDoc.updatedCount).toBe(1);
    });

    it('при невалидных строках завершает import как completed_with_errors и пишет errorSummary', async () => {
        const createdImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });

        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.JOB_START,
            jobId: createdImport.id,
            fileName: createdImport.fileName,
            fileSizeBytes: createdImport.fileSizeBytes,
        });
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.CHUNK,
            jobId: createdImport.id,
            chunkIndex: 0,
            isLast: true,
            rowsCount: 2,
            rows: [buildValidRow('5FNYF4H92FB000001'), 'BADVIN,BMW,X5,2020,10000,D1,available'],
        });
        await waitForProcessedRows(createdImport.id, 2);
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId: createdImport.id,
            totalChunks: 1,
            totalRows: 2,
        });

        const importDoc = await waitForImportState(
            createdImport.id,
            20_000,
            (doc) => doc?.status === ImportStatus.COMPLETED_WITH_ERRORS,
        );

        expect(importDoc.status).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
        expect(importDoc.successRows).toBe(1);
        expect(importDoc.failedRows).toBe(1);
        expect(importDoc.errorSummary.length).toBeGreaterThan(0);
    });

    it('повторная обработка одинакового VIN делает upsert без дублей в cars', async () => {
        const firstImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });
        const secondImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });

        const vin = 'JH4KA8270MC000001';
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.CHUNK,
            jobId: firstImport.id,
            chunkIndex: 0,
            isLast: true,
            rowsCount: 1,
            rows: [buildValidRow(vin, 10000)],
        });
        await waitForProcessedRows(firstImport.id, 1);
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId: firstImport.id,
            totalChunks: 1,
            totalRows: 1,
        });

        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.CHUNK,
            jobId: secondImport.id,
            chunkIndex: 0,
            isLast: true,
            rowsCount: 1,
            rows: [buildValidRow(vin, 12000)],
        });
        await waitForProcessedRows(secondImport.id, 1);
        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.STREAM_END,
            jobId: secondImport.id,
            totalChunks: 1,
            totalRows: 1,
        });

        await waitForImportState(
            secondImport.id,
            20_000,
            (doc) =>
                doc?.status === ImportStatus.COMPLETED ||
                doc?.status === ImportStatus.COMPLETED_WITH_ERRORS,
        );

        const cars = await carModel.find({ vin }).lean().exec();
        expect(cars).toHaveLength(1);
        expect(cars[0].mileage).toBe(12000);
        expect(cars[0].status).toBe(CarStatus.AVAILABLE);
    });

    it('невалидный payload с jobId помечает import как failed', async () => {
        const createdImport = await importModel.create({
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 128,
        });

        publishEvent({
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: 'invalid.event',
            jobId: createdImport.id,
        });

        const importDoc = await waitForImportState(
            createdImport.id,
            20_000,
            (doc) => doc?.status === ImportStatus.FAILED,
        );

        expect(importDoc.status).toBe(ImportStatus.FAILED);
        expect(importDoc.errorSummary.some((item) => item.code === 'WORKER_FATAL_ERROR')).toBe(
            true,
        );
    });
});
