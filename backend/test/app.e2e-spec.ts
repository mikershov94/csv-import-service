import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
    });

    it('/api (GET)', () => {
        return request(app.getHttpServer()).get('/api').expect(200).expect('Hello World!');
    });

    it('/api/health (GET)', () => {
        return request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' });
    });

    afterAll(async () => {
        await app.close();
    });
});
