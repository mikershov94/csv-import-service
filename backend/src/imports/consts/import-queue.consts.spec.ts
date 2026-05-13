import {
    DEFAULT_IMPORT_CHUNK_SIZE,
    MAX_IMPORT_CHUNK_SIZE,
    MIN_IMPORT_CHUNK_SIZE,
    resolveImportChunkSize,
} from './import-queue.consts';

describe('resolveImportChunkSize', () => {
    const originalValue = process.env.IMPORT_CHUNK_SIZE;

    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env.IMPORT_CHUNK_SIZE;
            return;
        }
        process.env.IMPORT_CHUNK_SIZE = originalValue;
    });

    it('возвращает значение по умолчанию, если env не задан', () => {
        delete process.env.IMPORT_CHUNK_SIZE;
        expect(resolveImportChunkSize()).toBe(DEFAULT_IMPORT_CHUNK_SIZE);
    });

    it('возвращает значение по умолчанию для невалидного env', () => {
        process.env.IMPORT_CHUNK_SIZE = 'abc';
        expect(resolveImportChunkSize()).toBe(DEFAULT_IMPORT_CHUNK_SIZE);
    });

    it('ограничивает значение снизу', () => {
        process.env.IMPORT_CHUNK_SIZE = '0';
        expect(resolveImportChunkSize()).toBe(DEFAULT_IMPORT_CHUNK_SIZE);

        process.env.IMPORT_CHUNK_SIZE = '-5';
        expect(resolveImportChunkSize()).toBe(DEFAULT_IMPORT_CHUNK_SIZE);
    });

    it('ограничивает значение сверху', () => {
        process.env.IMPORT_CHUNK_SIZE = String(MAX_IMPORT_CHUNK_SIZE + 1);
        expect(resolveImportChunkSize()).toBe(MAX_IMPORT_CHUNK_SIZE);
    });

    it('принимает валидное значение из env', () => {
        process.env.IMPORT_CHUNK_SIZE = String(MIN_IMPORT_CHUNK_SIZE + 99);
        expect(resolveImportChunkSize()).toBe(MIN_IMPORT_CHUNK_SIZE + 99);
    });
});
