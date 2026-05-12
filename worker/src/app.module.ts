import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CarsModule } from './cars/cars.module';
import { ImportsModule } from './imports/imports.module';

@Module({
    imports: [
        MongooseModule.forRoot(
            process.env.MONGODB_URI ?? 'mongodb://localhost:27017/csv_import_service',
        ),
        CarsModule,
        ImportsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
