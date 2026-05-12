import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [
        MongooseModule.forRoot(
            process.env.MONGODB_URI ?? 'mongodb://localhost:27017/csv_import_service',
        ),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
