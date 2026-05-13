import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Import, ImportSchema } from './entities/import.entity';
import { ImportsService } from './imports.service';
import { ImportQueueConsumer } from './queue/import-queue.consumer';

@Module({
    imports: [MongooseModule.forFeature([{ name: Import.name, schema: ImportSchema }])],
    providers: [ImportsService, ImportQueueConsumer],
    exports: [ImportsService],
})
export class ImportsModule {}
