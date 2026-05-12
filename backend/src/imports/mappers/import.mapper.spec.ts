import { Types } from 'mongoose';

import { ImportDocument, ImportStatus } from '../entities/import.entity';
import { mapImportToDetailsDto, mapImportToListItemDto } from './import.mapper';

describe('import.mapper', () => {
    function createImportDocument(overrides: Partial<ImportDocument> = {}): ImportDocument {
        const id = new Types.ObjectId().toString();
        const createdAt = new Date('2026-05-13T00:00:00.000Z');

        const baseDocument = {
            id,
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 123,
            totalRows: 100,
            processedRows: 80,
            successRows: 75,
            failedRows: 5,
            insertedCount: 40,
            updatedCount: 35,
            errorSummary: [{ code: 'INVALID_YEAR', message: 'Некорректный год', count: 2 }],
            startedAt: new Date('2026-05-13T00:01:00.000Z'),
            finishedAt: new Date('2026-05-13T00:02:00.000Z'),
            get: jest.fn((field: string) => (field === 'createdAt' ? createdAt : undefined)),
        };

        return { ...baseDocument, ...overrides } as unknown as ImportDocument;
    }

    it('корректно мапит документ импорта в элемент списка', () => {
        const doc = createImportDocument();

        const result = mapImportToListItemDto(doc);

        expect(result).toEqual({
            jobId: doc.id,
            status: doc.status,
            fileName: doc.fileName,
            fileSizeBytes: doc.fileSizeBytes,
            createdAt: '2026-05-13T00:00:00.000Z',
        });
    });

    it('возвращает валидный createdAt через fallback, если в документе нет createdAt', () => {
        const doc = createImportDocument({
            get: jest.fn(() => undefined),
        });

        const result = mapImportToListItemDto(doc);

        expect(new Date(result.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('корректно мапит документ импорта в детальную сводку', () => {
        const doc = createImportDocument();

        const result = mapImportToDetailsDto(doc);

        expect(result).toEqual({
            jobId: doc.id,
            status: doc.status,
            fileName: doc.fileName,
            fileSizeBytes: doc.fileSizeBytes,
            totalRows: doc.totalRows,
            processedRows: doc.processedRows,
            successRows: doc.successRows,
            failedRows: doc.failedRows,
            insertedCount: doc.insertedCount,
            updatedCount: doc.updatedCount,
            topErrors: [{ code: 'INVALID_YEAR', message: 'Некорректный год', count: 2 }],
            startedAt: '2026-05-13T00:01:00.000Z',
            finishedAt: '2026-05-13T00:02:00.000Z',
            createdAt: '2026-05-13T00:00:00.000Z',
        });
    });

    it('возвращает пустой список ошибок, если errorSummary пустой', () => {
        const doc = createImportDocument({ errorSummary: [] });

        const result = mapImportToDetailsDto(doc);

        expect(result.topErrors).toEqual([]);
    });

    it('оставляет startedAt и finishedAt undefined, если они отсутствуют', () => {
        const doc = createImportDocument({ startedAt: undefined, finishedAt: undefined });

        const result = mapImportToDetailsDto(doc);

        expect(result.startedAt).toBeUndefined();
        expect(result.finishedAt).toBeUndefined();
    });

    it('возвращает валидный createdAt в details через fallback, если поле отсутствует', () => {
        const doc = createImportDocument({
            get: jest.fn(() => undefined),
        });

        const result = mapImportToDetailsDto(doc);

        expect(new Date(result.createdAt).toString()).not.toBe('Invalid Date');
    });
});
