import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Import, ImportSchema } from './entities/import.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ParseMongoIdPipe } from './pipes/parse-mongo-id.pipe';

@Module({
    imports: [MongooseModule.forFeature([{ name: Import.name, schema: ImportSchema }])],
    controllers: [ImportsController],
    providers: [ImportsService, ParseMongoIdPipe],
})
export class ImportsModule {}
