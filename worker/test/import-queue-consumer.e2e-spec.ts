import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { IMPORT_QUEUE_EVENT_VERSION, IMPORT_QUEUE_EVENTS, ImportStatus } from '@shared';
import { Channel, ChannelModel, connect } from 'amqplib';
import { Model } from 'mongoose';

import { Import, ImportDocument } from '../src/imports/entities/import.entity';
import { ImportsModule } from '../src/imports/imports.module';

const TEST_MONGO_URI =
    process.env.TEST_MONGODB_URI ??
    'mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin';
const TEST_RABBIT_URI = process.env.TEST_RABBITMQ_URL ?? 'amqp://admin:Asdqwe123%21@localhost:5672';
const IMPORT_QUEUE_NAME = 'imports.queue';

describe('ImportQueueConsumer (e2e)', () => {
    let app: INestApplication;
    let queueConnection: ChannelModel;
    let queueChannel: Channel;
    let importModel: Model<ImportDocument>;

    async function bootstrap(): Promise<void> {
        process.env.MONGODB_URI = TEST_MONGO_URI;
        process.env.RABBITMQ_URL = TEST_RABBIT_URI;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(TEST_MONGO_URI), ImportsModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        importModel = app.get<Model<ImportDocument>>(getModelToken(Import.name));
    }

    async function waitForProcessingStatus(jobId: string, timeoutMs: number): Promise<void> {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            const importDoc = await importModel.findById(jobId).lean().exec();
            if (importDoc?.status === ImportStatus.PROCESSING) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        throw new Error(`Import ${jobId} не перешел в статус processing за ${timeoutMs}ms`);
    }

    beforeAll(async () => {
        queueConnection = await connect(TEST_RABBIT_URI);
        queueChannel = await queueConnection.createChannel();
        await queueChannel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
    });

    beforeEach(async () => {
        await bootstrap();
        await importModel.deleteMany({});
        await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
    });

    afterEach(async () => {
        if (importModel) {
            await importModel.deleteMany({});
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

        const payload = {
            version: IMPORT_QUEUE_EVENT_VERSION,
            type: IMPORT_QUEUE_EVENTS.JOB_START,
            jobId: createdImport.id,
            fileName: createdImport.fileName,
            fileSizeBytes: createdImport.fileSizeBytes,
        };

        queueChannel.sendToQueue(IMPORT_QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
        });

        await waitForProcessingStatus(createdImport.id, 10_000);
    });
});
