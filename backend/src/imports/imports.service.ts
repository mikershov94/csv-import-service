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
import { ImportQueuePublisher } from './queue/import-queue.publisher';

@Injectable()
export class ImportsService {
    constructor(
        @InjectModel(Import.name) private readonly importModel: Model<ImportDocument>,
        private readonly importQueuePublisher: ImportQueuePublisher,
    ) {}

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

        try {
            await this.publishFileAsChunks(createdImport.id, file);
        } catch (error) {
            await this.markImportFailed(createdImport.id, error);
            throw error;
        }

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

    private async publishFileAsChunks(jobId: string, file: Express.Multer.File): Promise<void> {
        const csvContent = file.buffer.toString('utf8');
        const lines = csvContent
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const dataRows = lines.slice(1);
        const chunkSize = 1000;

        await this.importQueuePublisher.publishJobStart(jobId, file.originalname, file.size);

        if (dataRows.length === 0) {
            await this.importQueuePublisher.publishStreamEnd(jobId, 0);
            return;
        }

        let chunkIndex = 0;
        for (let i = 0; i < dataRows.length; i += chunkSize) {
            const rows = dataRows.slice(i, i + chunkSize);
            const isLast = i + chunkSize >= dataRows.length;
            await this.importQueuePublisher.publishChunk(jobId, chunkIndex, isLast, rows);
            chunkIndex += 1;
        }

        await this.importQueuePublisher.publishStreamEnd(jobId, chunkIndex);
    }

    private async markImportFailed(jobId: string, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : 'Ошибка публикации в очередь';
        await this.importModel
            .updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: ImportStatus.FAILED,
                        finishedAt: new Date(),
                    },
                    $push: {
                        errorSummary: {
                            code: 'QUEUE_PUBLISH_ERROR',
                            message,
                            count: 1,
                        },
                    },
                },
            )
            .exec();
    }
}
