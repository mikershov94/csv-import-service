import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, of } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { GetImportsQueryDto } from './dto/get-imports-query.dto';
import { ImportDetailsDto } from './dto/import-details.dto';
import { ImportProgressEventDto } from './dto/import-progress-event.dto';
import { RecentImportsResponseDto } from './dto/recent-imports-response.dto';
import { Import, ImportDocument, ImportStatus } from './entities/import.entity';
import { mapImportToDetailsDto, mapImportToListItemDto } from './mappers/import.mapper';

@Injectable()
export class ImportsService {
    constructor(@InjectModel(Import.name) private readonly importModel: Model<ImportDocument>) {}

    async ensureImportExists(jobId: string): Promise<void> {
        const existingImport = await this.importModel.exists({ _id: jobId });
        if (!existingImport) {
            throw new NotFoundException(`Задача импорта ${jobId} не найдена`);
        }
    }

    async createImportJob(file: Express.Multer.File): Promise<CreateImportResponseDto> {
        const createdImport = await this.importModel.create({
            status: ImportStatus.QUEUED,
            fileName: file.originalname,
            fileSizeBytes: file.size,
        });

        return {
            jobId: createdImport.id,
            fileName: createdImport.fileName,
            fileSizeBytes: createdImport.fileSizeBytes,
        };
    }

    streamImportEvents(jobId: string): Observable<MessageEvent> {
        const data: ImportProgressEventDto = {
            jobId,
            status: ImportStatus.QUEUED,
            processedBytes: 0,
            validRows: 0,
            invalidRows: 0,
        };

        return of({
            type: 'progress',
            data,
        });
    }

    async getImportById(jobId: string): Promise<ImportDetailsDto> {
        const foundImport = await this.importModel.findById(jobId).exec();
        if (!foundImport) {
            throw new NotFoundException(`Задача импорта ${jobId} не найдена`);
        }

        return mapImportToDetailsDto(foundImport);
    }

    async getRecentImports(query: GetImportsQueryDto): Promise<RecentImportsResponseDto> {
        const limit = query.limit ?? 20;
        const filter: { status?: ImportStatus } = {};
        if (query.status) {
            filter.status = query.status;
        }

        const foundImports = await this.importModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();

        return { items: foundImports.map((item) => mapImportToListItemDto(item)) };
    }
}
