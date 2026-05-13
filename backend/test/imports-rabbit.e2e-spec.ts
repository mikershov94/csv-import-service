import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Channel, ChannelModel, connect } from 'amqplib';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';

import { Import, ImportDocument, ImportStatus } from '../src/imports/entities/import.entity';
import { ImportsModule } from '../src/imports/imports.module';

const TEST_MONGO_URI =
    process.env.TEST_MONGODB_URI ??
    'mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin';
const TEST_RABBIT_URI = process.env.TEST_RABBITMQ_URL ?? 'amqp://admin:Asdqwe123%21@localhost:5672';
const IMPORT_QUEUE_NAME = 'imports.queue';

describe('Imports RabbitMQ integration (e2e)', () => {
    let app: INestApplication<App>;
    let queueConnection: ChannelModel;
    let queueChannel: Channel;
    let importModel: Model<ImportDocument>;
    let rabbitAvailable = true;

    async function bootstrap(rabbitUrl: string): Promise<void> {
        process.env.MONGODB_URI = TEST_MONGO_URI;
        process.env.RABBITMQ_URL = rabbitUrl;
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(TEST_MONGO_URI), ImportsModule],
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

        importModel = app.get(getModelToken(Import.name));
    }

    async function collectQueueMessages(
        timeoutMs: number,
    ): Promise<Array<Record<string, unknown>>> {
        const startedAt = Date.now();
        const events: Array<Record<string, unknown>> = [];

        while (Date.now() - startedAt < timeoutMs) {
            const message = await queueChannel.get(IMPORT_QUEUE_NAME, { noAck: false });
            if (!message) {
                await new Promise((resolve) => setTimeout(resolve, 40));
                continue;
            }

            queueChannel.ack(message);
            events.push(JSON.parse(message.content.toString('utf8')) as Record<string, unknown>);
        }

        return events;
    }

    beforeAll(async () => {
        try {
            queueConnection = await connect(TEST_RABBIT_URI);
            queueChannel = await queueConnection.createChannel();
            await queueChannel.assertQueue(IMPORT_QUEUE_NAME, { durable: true });
        } catch {
            rabbitAvailable = false;
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

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    it('POST /api/imports публикует start/chunk/end сообщения в RabbitMQ', async () => {
        if (!rabbitAvailable) {
            throw new Error(
                `RabbitMQ недоступен по ${TEST_RABBIT_URI}. Выполните: docker compose up -d mongodb rabbitmq`,
            );
        }
        await bootstrap(TEST_RABBIT_URI);
        await queueChannel.purgeQueue(IMPORT_QUEUE_NAME);
        await importModel.deleteMany({});

        const response = await request(app.getHttpServer())
            .post('/api/imports')
            .attach(
                'file',
                Buffer.from(
                    'vin,make,model,year,mileage,dealershipId,status\n' +
                        'VIN12345678901234,BMW,X5,2020,10000,D1,available\n' +
                        'VIN12345678901235,Audi,A4,2021,5000,D2,sold\n',
                ),
                {
                    filename: 'cars.csv',
                    contentType: 'text/csv',
                },
            )
            .expect(201);

        const jobId = (response.body as { jobId: string }).jobId;
        const events = await collectQueueMessages(1200);

        expect(events.length).toBeGreaterThanOrEqual(3);
        expect(events[0].type).toBe('import.job.start');
        expect(events[1].type).toBe('import.chunk');
        expect(events[events.length - 1].type).toBe('import.stream.end');
        expect(events.some((event) => event.jobId === jobId)).toBe(true);
    });

    it('помечает import как failed, если публикация в RabbitMQ недоступна', async () => {
        if (!rabbitAvailable) {
            throw new Error(
                `RabbitMQ недоступен по ${TEST_RABBIT_URI}. Выполните: docker compose up -d mongodb rabbitmq`,
            );
        }
        await bootstrap('amqp://admin:Asdqwe123%21@localhost:5673');
        await importModel.deleteMany({});

        const createResponse = await request(app.getHttpServer())
            .post('/api/imports')
            .attach('file', Buffer.from('vin,make\nVIN12345678901234,BMW\n'), {
                filename: 'cars.csv',
                contentType: 'text/csv',
            });

        expect(createResponse.status).toBeGreaterThanOrEqual(500);

        const importDoc = await importModel.findOne().sort({ createdAt: -1 }).exec();

        expect(importDoc).not.toBeNull();
        expect(importDoc?.status).toBe(ImportStatus.FAILED);
    });
});
