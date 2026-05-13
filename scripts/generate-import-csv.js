#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const HEADER = 'vin,make,model,year,mileage,dealershipId,status';
const STATUSES = ['available', 'sold', 'reserved', 'service'];

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }
        if (token.includes('=')) {
            const [rawKey, rawValue] = token.split('=');
            const key = rawKey.slice(2);
            args[key] = rawValue;
            continue;
        }
        const key = token.slice(2);
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
            args[key] = true;
            continue;
        }
        args[key] = value;
        i += 1;
    }
    return args;
}

function padDigits(value, length) {
    return String(value).padStart(length, '0');
}

function buildVin(index) {
    return `1HGCM82633A${padDigits(index, 6)}`;
}

function buildValidRow(index) {
    const vin = buildVin(index);
    const make = index % 2 === 0 ? 'BMW' : 'Audi';
    const model = index % 2 === 0 ? 'X5' : 'Q7';
    const year = 2010 + (index % 15);
    const mileage = 10_000 + index * 17;
    const dealershipId = `D${(index % 5) + 1}`;
    const status = STATUSES[index % STATUSES.length];
    return `${vin},${make},${model},${year},${mileage},${dealershipId},${status}`;
}

function buildInvalidRow(index) {
    const valid = buildValidRow(index);
    if (index % 3 === 0) {
        return valid.replace(/^.{17}/, 'BADVIN');
    }
    if (index % 3 === 1) {
        const parts = valid.split(',');
        parts[3] = '1899';
        return parts.join(',');
    }
    const parts = valid.split(',');
    parts[4] = '-10';
    return parts.join(',');
}

function generateRows({ rows, mode, invalidRate }) {
    const output = [];
    for (let i = 0; i < rows; i += 1) {
        const validRow = buildValidRow(i + 1);

        if (mode === 'happy') {
            output.push(validRow);
            continue;
        }

        if (mode === 'idempotency') {
            const duplicateVinIndex = Math.floor(i / 2) + 1;
            output.push(buildValidRow(duplicateVinIndex));
            continue;
        }

        const invalidEvery = Math.max(1, Math.floor(1 / Math.max(0.0001, invalidRate)));
        const shouldBeInvalid = (i + 1) % invalidEvery === 0;
        output.push(shouldBeInvalid ? buildInvalidRow(i + 1) : validRow);
    }
    return output;
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
}

function writeStreamLine(stream, line) {
    if (!stream.write(`${line}\n`)) {
        return new Promise((resolve) => stream.once('drain', resolve));
    }
    return Promise.resolve();
}

async function generateSampleFile({ rows, dups, out }) {
    if (!Number.isInteger(dups) || dups < 0) {
        throw new Error('--dups must be a non-negative integer');
    }
    if (dups > rows) {
        throw new Error('--dups cannot be greater than --rows');
    }

    ensureDir(out);
    const stream = fs.createWriteStream(out, { encoding: 'utf8' });
    await writeStreamLine(stream, HEADER);

    const uniqueRows = rows - dups;
    for (let i = 0; i < uniqueRows; i += 1) {
        await writeStreamLine(stream, buildValidRow(i + 1));
    }

    for (let i = 0; i < dups; i += 1) {
        const duplicateVinIndex = (i % Math.max(1, uniqueRows)) + 1;
        await writeStreamLine(stream, buildValidRow(duplicateVinIndex));
    }

    await new Promise((resolve, reject) => {
        stream.end(() => resolve());
        stream.on('error', reject);
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const mode = args.mode || 'happy';
    const rows = Number.parseInt(args.rows || '100', 10);
    const invalidRate = Number.parseFloat(args['invalid-rate'] || '0.2');
    const dups = Number.parseInt(args.dups || '0', 10);
    const out = args.out || `./test/artifacts/${mode}.csv`;

    if (!['happy', 'mixed', 'idempotency', 'sample'].includes(mode)) {
        throw new Error(`Unsupported mode: ${mode}`);
    }
    if (!Number.isInteger(rows) || rows < 1) {
        throw new Error('--rows must be a positive integer');
    }
    if (mode === 'mixed' && (Number.isNaN(invalidRate) || invalidRate < 0 || invalidRate > 1)) {
        throw new Error('--invalid-rate must be between 0 and 1 for mixed mode');
    }

    if (mode === 'sample') {
        await generateSampleFile({ rows, dups, out });
        // eslint-disable-next-line no-console
        console.log(`CSV generated: ${out} (${rows} rows, mode=${mode}, dups=${dups})`);
        return;
    }

    const dataRows = generateRows({ rows, mode, invalidRate: mode === 'mixed' ? invalidRate : 0 });
    const content = `${HEADER}\n${dataRows.join('\n')}\n`;
    ensureDir(out);
    fs.writeFileSync(out, content, 'utf8');

    // eslint-disable-next-line no-console
    console.log(`CSV generated: ${out} (${rows} rows, mode=${mode})`);
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
