import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, of } from 'rxjs';

import { resolveImportChunkSize } from './consts/import-queue.consts';
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
            await this.publishImportFile(createdImport.id, file);
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

    private async publishImportFile(jobId: string, file: Express.Multer.File): Promise<void> {
        const chunkSize = resolveImportChunkSize();
        await this.importQueuePublisher.publishJobStart(jobId, file.originalname, file.size);
        const fileText = file.buffer.toString('utf8');
        const lines = fileText.split(/\r?\n/u);

        let isHeaderSkipped = false;
        let chunkIndex = 0;
        let totalRows = 0;
        let pendingRows: string[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.length === 0) {
                continue;
            }

            if (!isHeaderSkipped) {
                isHeaderSkipped = true;
                continue;
            }

            pendingRows.push(line);
            totalRows += 1;

            if (pendingRows.length < chunkSize) {
                continue;
            }

            await this.importQueuePublisher.publishChunk(jobId, chunkIndex, false, pendingRows);
            chunkIndex += 1;
            pendingRows = [];
        }

        if (pendingRows.length > 0) {
            await this.importQueuePublisher.publishChunk(jobId, chunkIndex, true, pendingRows);
            chunkIndex += 1;
        }

        await this.importQueuePublisher.publishStreamEnd(jobId, chunkIndex, totalRows);
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
