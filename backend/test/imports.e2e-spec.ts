import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { of } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';

import { ImportStatus } from '../src/imports/entities/import.entity';
import { ImportsController } from '../src/imports/imports.controller';
import { ImportsService } from '../src/imports/imports.service';
import { CsvFileValidationPipe } from '../src/imports/pipes/csv-file-validation.pipe';
import { ParseMongoIdPipe } from '../src/imports/pipes/parse-mongo-id.pipe';

describe('ImportsController (e2e)', () => {
    let app: INestApplication<App>;
    let importsService: jest.Mocked<ImportsService>;

    beforeAll(async () => {
        const importsServiceMock: jest.Mocked<ImportsService> = {
            ensureImportExists: jest.fn(),
            createImportJob: jest.fn(),
            streamImportEvents: jest.fn(),
            getImportById: jest.fn(),
            getRecentImports: jest.fn(),
        } as unknown as jest.Mocked<ImportsService>;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [ImportsController],
            providers: [
                CsvFileValidationPipe,
                ParseMongoIdPipe,
                {
                    provide: ImportsService,
                    useValue: importsServiceMock,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        );
        await app.init();

        importsService = moduleFixture.get(ImportsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /api/imports создаёт задачу при валидном CSV', async () => {
        const jobId = new Types.ObjectId().toString();
        importsService.createImportJob.mockResolvedValue({
            jobId,
            fileName: 'cars.csv',
            fileSizeBytes: 16,
        });

        await request(app.getHttpServer())
            .post('/api/imports')
            .attach('file', Buffer.from('vin,make\nA1234567890123456,BMW\n'), {
                filename: 'cars.csv',
                contentType: 'text/csv',
            })
            .expect(201)
            .expect((response) => {
                const body = response.body as { jobId: string; fileName: string };
                expect(body.jobId).toBe(jobId);
                expect(body.fileName).toBe('cars.csv');
            });
    });

    it('POST /api/imports возвращает 400, если файл не передан', async () => {
        await request(app.getHttpServer()).post('/api/imports').expect(400);
    });

    it('GET /api/imports/:jobId возвращает сводку для существующей задачи', async () => {
        const jobId = new Types.ObjectId().toString();
        importsService.getImportById.mockResolvedValue({
            jobId,
            status: ImportStatus.QUEUED,
            fileName: 'cars.csv',
            fileSizeBytes: 100,
            totalRows: 10,
            processedRows: 0,
            successRows: 0,
            failedRows: 0,
            insertedCount: 0,
            updatedCount: 0,
            topErrors: [],
            createdAt: '2026-05-13T00:00:00.000Z',
        });

        await request(app.getHttpServer())
            .get(`/api/imports/${jobId}`)
            .expect(200)
            .expect((response) => {
                const body = response.body as { jobId: string; fileName: string };
                expect(body.jobId).toBe(jobId);
                expect(body.fileName).toBe('cars.csv');
            });
    });

    it('GET /api/imports/:jobId возвращает 400 для невалидного jobId', async () => {
        await request(app.getHttpServer()).get('/api/imports/not-a-mongo-id').expect(400);
    });

    it('GET /api/imports возвращает список задач', async () => {
        const jobId = new Types.ObjectId().toString();
        importsService.getRecentImports.mockResolvedValue({
            items: [
                {
                    jobId,
                    status: ImportStatus.QUEUED,
                    fileName: 'cars.csv',
                    fileSizeBytes: 100,
                    createdAt: '2026-05-13T00:00:00.000Z',
                },
            ],
        });

        await request(app.getHttpServer())
            .get('/api/imports')
            .expect(200)
            .expect((response) => {
                const body = response.body as { items: Array<{ jobId: string }> };
                expect(body.items).toHaveLength(1);
                expect(body.items[0].jobId).toBe(jobId);
            });
    });

    it('GET /api/imports/:jobId/events открывает SSE и отдаёт progress событие', async () => {
        const jobId = new Types.ObjectId().toString();
        importsService.ensureImportExists.mockResolvedValue(undefined);
        importsService.streamImportEvents.mockReturnValue(
            of({
                type: 'progress',
                data: {
                    jobId,
                    status: ImportStatus.QUEUED,
                    processedBytes: 0,
                    validRows: 0,
                    invalidRows: 0,
                },
            }),
        );

        await request(app.getHttpServer())
            .get(`/api/imports/${jobId}/events`)
            .expect(200)
            .expect('Content-Type', /text\/event-stream/)
            .expect((response) => {
                expect(response.text).toContain('event: progress');
                expect(response.text).toContain(jobId);
            });
    });
});
