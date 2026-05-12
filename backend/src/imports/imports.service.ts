import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, of } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { GetImportsQueryDto } from './dto/get-imports-query.dto';
import { ImportDetailsDto } from './dto/import-details.dto';
import { ImportErrorSummaryItemDto } from './dto/import-error-summary-item.dto';
import { ImportListItemDto } from './dto/import-list-item.dto';
import { ImportProgressEventDto } from './dto/import-progress-event.dto';
import { RecentImportsResponseDto } from './dto/recent-imports-response.dto';
import { Import, ImportDocument, ImportStatus } from './entities/import.entity';

@Injectable()
export class ImportsService {
    constructor(@InjectModel(Import.name) private readonly importModel: Model<ImportDocument>) {}

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
            throw new NotFoundException(`Import job ${jobId} not found`);
        }

        return this.mapImportToDetailsDto(foundImport);
    }

    async getRecentImports(query: GetImportsQueryDto): Promise<RecentImportsResponseDto> {
        const limit = query.limit ?? 20;
        const filter: { status?: ImportStatus } = {};
        if (query.status) {
            filter.status = query.status;
        }

        const foundImports = await this.importModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();

        return { items: foundImports.map((item) => this.mapImportToListItemDto(item)) };
    }

    private mapImportToListItemDto(importEntity: ImportDocument): ImportListItemDto {
        return {
            jobId: importEntity.id,
            status: importEntity.status,
            fileName: importEntity.fileName,
            fileSizeBytes: importEntity.fileSizeBytes,
            createdAt: this.getCreatedAt(importEntity).toISOString(),
        };
    }

    private mapImportToErrorSummaryItemDto(errorItem: {
        code: string;
        message: string;
        count: number;
    }): ImportErrorSummaryItemDto {
        return {
            code: errorItem.code,
            message: errorItem.message,
            count: errorItem.count,
        };
    }

    private mapImportToDetailsDto(importEntity: ImportDocument): ImportDetailsDto {
        return {
            jobId: importEntity.id,
            status: importEntity.status,
            fileName: importEntity.fileName,
            fileSizeBytes: importEntity.fileSizeBytes,
            totalRows: importEntity.totalRows,
            processedRows: importEntity.processedRows,
            successRows: importEntity.successRows,
            failedRows: importEntity.failedRows,
            insertedCount: importEntity.insertedCount,
            updatedCount: importEntity.updatedCount,
            topErrors: importEntity.errorSummary.map((item) => this.mapImportToErrorSummaryItemDto(item)),
            startedAt: importEntity.startedAt?.toISOString(),
            finishedAt: importEntity.finishedAt?.toISOString(),
            createdAt: this.getCreatedAt(importEntity).toISOString(),
        };
    }

    private getCreatedAt(importEntity: ImportDocument): Date {
        const createdAt = importEntity.get('createdAt') as Date | undefined;
        return createdAt ?? new Date();
    }
}
