import {
    BadRequestException,
    Controller,
    Get,
    MessageEvent,
    Param,
    Post,
    Sse,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { ImportSummaryDto } from './dto/import-summary.dto';
import { RecentImportsResponseDto } from './dto/recent-imports-response.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
    constructor(private readonly importsService: ImportsService) {}

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    createImport(@UploadedFile() file?: Express.Multer.File): CreateImportResponseDto {
        if (!file) {
            throw new BadRequestException('file is required');
        }

        return this.importsService.createImportJob(file);
    }

    @Sse(':jobId/events')
    streamImportEvents(@Param('jobId') jobId: string): Observable<MessageEvent> {
        return this.importsService.streamImportEvents(jobId);
    }

    @Get(':jobId')
    getImportById(@Param('jobId') jobId: string): ImportSummaryDto {
        return this.importsService.getImportById(jobId);
    }

    @Get()
    getRecentImports(): RecentImportsResponseDto {
        return this.importsService.getRecentImports();
    }
}
