import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, of } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { ImportProgressEventDto } from './dto/import-progress-event.dto';
import { ImportSummaryDto } from './dto/import-summary.dto';
import { RecentImportsResponseDto } from './dto/recent-imports-response.dto';

@Injectable()
export class ImportsService {
    createImportJob(file: Express.Multer.File): CreateImportResponseDto {
        return {
            jobId: 'stub-job-id',
            fileName: file.originalname,
            fileSizeBytes: file.size,
        };
    }

    streamImportEvents(jobId: string): Observable<MessageEvent> {
        const data: ImportProgressEventDto = {
            jobId,
            status: 'queued',
            processedBytes: 0,
            validRows: 0,
            invalidRows: 0,
        };

        return of({
            type: 'progress',
            data,
        });
    }

    getImportById(jobId: string): ImportSummaryDto {
        return {
            jobId,
            status: 'queued',
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            topErrors: [],
        };
    }

    getRecentImports(): RecentImportsResponseDto {
        return { items: [] };
    }
}
