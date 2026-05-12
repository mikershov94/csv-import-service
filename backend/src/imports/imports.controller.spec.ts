import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { of } from 'rxjs';

import { ImportStatus } from './entities/import.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

describe('ImportsController', () => {
    let controller: ImportsController;
    let importsService: jest.Mocked<ImportsService>;

    beforeEach(async () => {
        const importsServiceMock: jest.Mocked<ImportsService> = {
            ensureImportExists: jest.fn(),
            createImportJob: jest.fn(),
            streamImportEvents: jest.fn(),
            getImportById: jest.fn(),
            getRecentImports: jest.fn(),
        } as unknown as jest.Mocked<ImportsService>;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ImportsController],
            providers: [
                {
                    provide: ImportsService,
                    useValue: importsServiceMock,
                },
            ],
        }).compile();

        controller = module.get<ImportsController>(ImportsController);
        importsService = module.get(ImportsService);
    });

    it('контроллер должен быть создан', () => {
        expect(controller).toBeDefined();
    });

    it('создаёт задачу импорта и возвращает ответ сервиса', async () => {
        const file = { originalname: 'cars.csv', size: 123 } as Express.Multer.File;
        const serviceResponse = {
            jobId: new Types.ObjectId().toString(),
            fileName: 'cars.csv',
            fileSizeBytes: 123,
        };
        importsService.createImportJob.mockResolvedValue(serviceResponse);

        const result = await controller.createImport(file);

        expect(importsService.createImportJob.mock.calls).toEqual([[file]]);
        expect(result).toEqual(serviceResponse);
    });

    it('для SSE сначала проверяет существование job, затем возвращает поток событий', async () => {
        const jobId = new Types.ObjectId().toString();
        const stream = of({
            type: 'progress',
            data: {
                jobId,
                status: ImportStatus.QUEUED,
                processedBytes: 0,
                validRows: 0,
                invalidRows: 0,
            },
        });
        importsService.ensureImportExists.mockResolvedValue(undefined);
        importsService.streamImportEvents.mockReturnValue(stream);

        const result = await controller.streamImportEvents(jobId);

        expect(importsService.ensureImportExists.mock.calls).toEqual([[jobId]]);
        expect(importsService.streamImportEvents.mock.calls).toEqual([[jobId]]);
        expect(result).toBe(stream);
    });

    it('возвращает детальную сводку по задаче импорта', async () => {
        const jobId = new Types.ObjectId().toString();
        const serviceResponse = {
            jobId,
            status: ImportStatus.PROCESSING,
            fileName: 'cars.csv',
            fileSizeBytes: 512,
            totalRows: 100,
            processedRows: 30,
            successRows: 28,
            failedRows: 2,
            insertedCount: 15,
            updatedCount: 13,
            topErrors: [{ code: 'INVALID_VIN', message: 'Некорректный VIN', count: 2 }],
            startedAt: '2026-05-13T00:01:00.000Z',
            finishedAt: undefined,
            createdAt: '2026-05-13T00:00:00.000Z',
        };
        importsService.getImportById.mockResolvedValue(serviceResponse);

        const result = await controller.getImportById(jobId);

        expect(importsService.getImportById.mock.calls).toEqual([[jobId]]);
        expect(result).toEqual(serviceResponse);
    });

    it('возвращает список последних импортов с учётом query', async () => {
        const query = { limit: 10, status: ImportStatus.FAILED };
        const serviceResponse = {
            items: [
                {
                    jobId: new Types.ObjectId().toString(),
                    status: ImportStatus.FAILED,
                    fileName: 'cars.csv',
                    fileSizeBytes: 1024,
                    createdAt: '2026-05-13T00:00:00.000Z',
                },
            ],
        };
        importsService.getRecentImports.mockResolvedValue(serviceResponse);

        const result = await controller.getRecentImports(query);

        expect(importsService.getRecentImports.mock.calls).toEqual([[query]]);
        expect(result).toEqual(serviceResponse);
    });
});
