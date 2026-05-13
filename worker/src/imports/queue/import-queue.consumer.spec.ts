/* eslint-disable @typescript-eslint/unbound-method */
import { IMPORT_QUEUE_EVENT_VERSION, IMPORT_QUEUE_EVENTS } from '@shared';
import { Channel, ConsumeMessage } from 'amqplib';

import { CarsService } from '../../cars/cars.service';
import { ImportsService } from '../imports.service';
import { ImportQueueConsumer } from './import-queue.consumer';

type ConsumerTestAccess = {
    handleChunk: (event: {
        version: number;
        type: string;
        jobId: string;
        chunkIndex: number;
        isLast: boolean;
        rowsCount: number;
        rows: string[];
    }) => Promise<void>;
    handleStreamEnd: (event: {
        version: number;
        type: string;
        jobId: string;
        totalChunks: number;
        totalRows: number;
    }) => Promise<void>;
    handleMessage: (message: ConsumeMessage | null) => Promise<void>;
    channel?: Pick<Channel, 'ack' | 'nack'>;
};

const VALID_ROW = '1HGCM82633A004352,BMW,X5,2020,10000,D1,available';
const INVALID_VIN_ROW = 'BADVIN,BMW,X5,2020,10000,D1,available';
const CHUNK_BASE_EVENT = {
    version: IMPORT_QUEUE_EVENT_VERSION,
    type: IMPORT_QUEUE_EVENTS.CHUNK,
    chunkIndex: 0,
    isLast: false,
};
const STREAM_END_BASE_EVENT = {
    version: IMPORT_QUEUE_EVENT_VERSION,
    type: IMPORT_QUEUE_EVENTS.STREAM_END,
    totalChunks: 1,
    totalRows: 5,
};

describe('ImportQueueConsumer', () => {
    let consumer: ImportQueueConsumer;
    let importsService: jest.Mocked<ImportsService>;
    let carsService: jest.Mocked<CarsService>;

    beforeEach(() => {
        importsService = {
            applyProgress: jest.fn(),
            hasErrors: jest.fn(),
            markCompleted: jest.fn(),
            markFailed: jest.fn(),
            markProcessing: jest.fn(),
        } as unknown as jest.Mocked<ImportsService>;

        carsService = {
            bulkUpsertCars: jest.fn(),
        } as unknown as jest.Mocked<CarsService>;

        consumer = new ImportQueueConsumer(importsService, carsService);
    });

    it('handleChunk обрабатывает валидные и невалидные строки и пишет фактические метрики', async () => {
        carsService.bulkUpsertCars.mockResolvedValue({
            insertedCount: 1,
            updatedCount: 0,
            processedCount: 1,
        });

        const testAccess = consumer as unknown as ConsumerTestAccess;
        await testAccess.handleChunk({
            ...CHUNK_BASE_EVENT,
            jobId: 'job-1',
            rowsCount: 2,
            rows: [VALID_ROW, INVALID_VIN_ROW],
        });

        expect(carsService.bulkUpsertCars).toHaveBeenCalledTimes(1);
        expect(importsService.applyProgress).toHaveBeenCalledWith(
            'job-1',
            expect.objectContaining({
                processedRows: 2,
                successRows: 1,
                failedRows: 1,
                insertedCount: 1,
                updatedCount: 0,
            }),
        );
    });

    it('handleChunk помечает весь chunk как failed при ошибке bulk upsert', async () => {
        carsService.bulkUpsertCars.mockRejectedValue(new Error('mongo down'));

        const testAccess = consumer as unknown as ConsumerTestAccess;
        await testAccess.handleChunk({
            ...CHUNK_BASE_EVENT,
            jobId: 'job-2',
            chunkIndex: 1,
            isLast: true,
            rowsCount: 1,
            rows: [VALID_ROW],
        });

        expect(importsService.applyProgress).toHaveBeenCalledWith(
            'job-2',
            expect.objectContaining({
                processedRows: 1,
                successRows: 0,
                failedRows: 1,
                insertedCount: 0,
                updatedCount: 0,
            }),
        );
    });

    it('handleStreamEnd завершает import с фактическим значением hasErrors', async () => {
        importsService.hasErrors.mockResolvedValue(true);

        const testAccess = consumer as unknown as ConsumerTestAccess;
        await testAccess.handleStreamEnd({
            ...STREAM_END_BASE_EVENT,
            jobId: 'job-3',
        });

        expect(importsService.hasErrors).toHaveBeenCalledWith('job-3');
        expect(importsService.markCompleted).toHaveBeenCalledWith('job-3', true);
    });

    it('handleMessage не делает requeue для невалидного payload и помечает import как failed при наличии jobId', async () => {
        const ack = jest.fn();
        const nack = jest.fn();
        const testAccess = consumer as unknown as ConsumerTestAccess;
        testAccess.channel = { ack, nack };

        await testAccess.handleMessage({
            content: Buffer.from(
                JSON.stringify({
                    version: IMPORT_QUEUE_EVENT_VERSION,
                    type: 'bad.event',
                    jobId: 'job-4',
                }),
            ),
        } as ConsumeMessage);

        expect(importsService.markFailed).toHaveBeenCalledWith(
            'job-4',
            expect.any(String),
            'WORKER_FATAL_ERROR',
        );
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();
    });
});
