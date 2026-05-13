export const DEFAULT_IMPORT_CHUNK_SIZE = 1000;
export const MIN_IMPORT_CHUNK_SIZE = 1;
export const MAX_IMPORT_CHUNK_SIZE = 10000;

function parsePositiveInteger(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        return null;
    }
    return parsed;
}

export function resolveImportChunkSize(): number {
    const rawValue = process.env.IMPORT_CHUNK_SIZE;
    if (!rawValue) {
        return DEFAULT_IMPORT_CHUNK_SIZE;
    }

    const parsed = parsePositiveInteger(rawValue);
    if (!parsed) {
        return DEFAULT_IMPORT_CHUNK_SIZE;
    }

    if (parsed < MIN_IMPORT_CHUNK_SIZE) {
        return MIN_IMPORT_CHUNK_SIZE;
    }
    if (parsed > MAX_IMPORT_CHUNK_SIZE) {
        return MAX_IMPORT_CHUNK_SIZE;
    }

    return parsed;
}
