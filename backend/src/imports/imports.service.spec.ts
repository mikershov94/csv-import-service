import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { ImportDetailsDto } from './dto/import-details.dto';
import { ImportListItemDto } from './dto/import-list-item.dto';
import { ImportDocument, ImportStatus } from './entities/import.entity';
import { Import } from './entities/import.entity';
import { ImportsService } from './imports.service';
import { ImportQueuePublisher } from './queue/import-queue.publisher';

describe('ImportsService', () => {
    let service: ImportsService;
    let importModel: {
        create: jest.Mock;
        exists: jest.Mock;
        findById: jest.Mock;
        find: jest.Mock;
        updateOne: jest.Mock;
    };
    let importQueuePublisher: jest.Mocked<ImportQueuePublisher>;

    function createImportDocument(overrides: Partial<ImportDocument> = {}): ImportDocument {
        const id = new Types.ObjectId().toString();
        const createdAt = new Date('2026-05-13T00:00:00.000Z');

        const baseDocument = {
            id,
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 123,
            totalRows: 10,
            processedRows: 6,
            successRows: 5,
            failedRows: 1,
            insertedCount: 3,
            updatedCount: 2,
            errorSummary: [{ code: 'INVALID_VIN', message: 'Некорректный VIN', count: 1 }],
            startedAt: new Date('2026-05-13T00:01:00.000Z'),
            finishedAt: new Date('2026-05-13T00:02:00.000Z'),
            get: jest.fn((field: string) => (field === 'createdAt' ? createdAt : undefined)),
        };

        return { ...baseDocument, ...overrides } as unknown as ImportDocument;
    }

    beforeEach(async () => {
        importModel = {
            create: jest.fn(),
            exists: jest.fn(),
            findById: jest.fn(),
            find: jest.fn(),
            updateOne: jest.fn(),
        };
        importQueuePublisher = {
            publishJobStart: jest.fn(),
            publishChunk: jest.fn(),
            publishStreamEnd: jest.fn(),
            onModuleDestroy: jest.fn(),
        } as unknown as jest.Mocked<ImportQueuePublisher>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ImportsService,
                {
                    provide: getModelToken(Import.name),
                    useValue: importModel,
                },
                {
                    provide: ImportQueuePublisher,
                    useValue: importQueuePublisher,
                },
            ],
        }).compile();

        service = module.get<ImportsService>(ImportsService);
    });

    it('сервис должен быть создан', () => {
        expect(service).toBeDefined();
    });

    it('не выбрасывает ошибку, если задача импорта существует', async () => {
        importModel.exists.mockResolvedValue({ _id: 'id' });

        await expect(
            service.ensureImportExists(new Types.ObjectId().toString()),
        ).resolves.toBeUndefined();
    });

    it('выбрасывает NotFoundException, если задача импорта не найдена', async () => {
        importModel.exists.mockResolvedValue(null);

        await expect(
            service.ensureImportExists(new Types.ObjectId().toString()),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('создаёт задачу импорта со статусом queued и возвращает данные job', async () => {
        const file = {
            originalname: 'test.csv',
            size: 456,
            buffer: Buffer.from('vin,make\nVIN12345678901234,BMW\nVIN12345678901235,Audi\n'),
        } as Express.Multer.File;
        const createdDoc = createImportDocument({
            id: new Types.ObjectId().toString(),
            fileName: file.originalname,
            fileSizeBytes: file.size,
            status: ImportStatus.QUEUED,
        });
        importModel.create.mockResolvedValue(createdDoc);

        const result: CreateImportResponseDto = await service.createImportJob(file);

        expect(importModel.create).toHaveBeenCalledWith({
            status: ImportStatus.QUEUED,
            fileName: file.originalname,
            fileSizeBytes: file.size,
        });
        expect(result).toEqual({
            jobId: createdDoc.id,
            fileName: file.originalname,
            fileSizeBytes: file.size,
        });
        expect(importQueuePublisher.publishJobStart.mock.calls).toHaveLength(1);
        expect(importQueuePublisher.publishChunk.mock.calls).toHaveLength(1);
        expect(importQueuePublisher.publishStreamEnd.mock.calls).toEqual([[createdDoc.id, 1]]);
    });

    it('возвращает стартовое SSE-событие прогресса для job', async () => {
        const jobId = new Types.ObjectId().toString();

        const event = await firstValueFrom(service.streamImportEvents(jobId));

        expect(event).toEqual({
            type: 'progress',
            data: {
                jobId,
                status: ImportStatus.QUEUED,
                processedBytes: 0,
                validRows: 0,
                invalidRows: 0,
            },
        });
    });

    it('помечает import как failed, если публикация в очередь завершилась ошибкой', async () => {
        const file = {
            originalname: 'test.csv',
            size: 10,
            buffer: Buffer.from('vin,make\nVIN12345678901234,BMW\n'),
        } as Express.Multer.File;
        const createdDoc = createImportDocument({
            id: new Types.ObjectId().toString(),
            fileName: file.originalname,
            fileSizeBytes: file.size,
        });
        importModel.create.mockResolvedValue(createdDoc);
        importQueuePublisher.publishJobStart.mockRejectedValue(new Error('publish failed'));
        const exec = jest.fn().mockResolvedValue({ acknowledged: true });
        importModel.updateOne.mockReturnValue({ exec });

        await expect(service.createImportJob(file)).rejects.toThrow('publish failed');
        expect(importModel.updateOne).toHaveBeenCalled();
    });

    it('возвращает детальную сводку по найденной задаче импорта', async () => {
        const doc = createImportDocument();
        importModel.findById.mockReturnValue({
            exec: jest.fn().mockResolvedValue(doc),
        });

        const result: ImportDetailsDto = await service.getImportById(doc.id);

        expect(result.jobId).toBe(doc.id);
        expect(result.fileName).toBe(doc.fileName);
        expect(result.topErrors).toEqual([
            { code: 'INVALID_VIN', message: 'Некорректный VIN', count: 1 },
        ]);
        expect(result.createdAt).toBe('2026-05-13T00:00:00.000Z');
    });

    it('выбрасывает NotFoundException, если задача импорта по id не найдена', async () => {
        importModel.findById.mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
        });

        await expect(service.getImportById(new Types.ObjectId().toString())).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('возвращает последние импорты с лимитом по умолчанию 20', async () => {
        const doc = createImportDocument();
        const exec = jest.fn().mockResolvedValue([doc]);
        const limit = jest.fn().mockReturnValue({ exec });
        const sort = jest.fn().mockReturnValue({ limit });
        importModel.find.mockReturnValue({ sort });

        const result = await service.getRecentImports({});

        expect(importModel.find).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(limit).toHaveBeenCalledWith(20);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].jobId).toBe(doc.id);
    });

    it('применяет фильтр по статусу, если он передан в query', async () => {
        const doc = createImportDocument({ status: ImportStatus.PROCESSING });
        const exec = jest.fn().mockResolvedValue([doc]);
        const limit = jest.fn().mockReturnValue({ exec });
        const sort = jest.fn().mockReturnValue({ limit });
        importModel.find.mockReturnValue({ sort });

        await service.getRecentImports({ status: ImportStatus.PROCESSING, limit: 10 });

        expect(importModel.find).toHaveBeenCalledWith({ status: ImportStatus.PROCESSING });
        expect(limit).toHaveBeenCalledWith(10);
    });

    it('возвращает список импортов в формате list item dto', async () => {
        const firstDoc = createImportDocument({
            id: new Types.ObjectId().toString(),
            fileName: '1.csv',
        });
        const secondDoc = createImportDocument({
            id: new Types.ObjectId().toString(),
            fileName: '2.csv',
        });
        const exec = jest.fn().mockResolvedValue([firstDoc, secondDoc]);
        const limit = jest.fn().mockReturnValue({ exec });
        const sort = jest.fn().mockReturnValue({ limit });
        importModel.find.mockReturnValue({ sort });

        const result: { items: ImportListItemDto[] } = await service.getRecentImports({ limit: 2 });

        expect(result.items).toEqual([
            {
                jobId: firstDoc.id,
                status: firstDoc.status,
                fileName: '1.csv',
                fileSizeBytes: firstDoc.fileSizeBytes,
                createdAt: '2026-05-13T00:00:00.000Z',
            },
            {
                jobId: secondDoc.id,
                status: secondDoc.status,
                fileName: '2.csv',
                fileSizeBytes: secondDoc.fileSizeBytes,
                createdAt: '2026-05-13T00:00:00.000Z',
            },
        ]);
    });
});
