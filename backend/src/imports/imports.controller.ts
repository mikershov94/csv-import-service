import {
    Controller,
    Get,
    MessageEvent,
    Param,
    Post,
    Query,
    Sse,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';

import { CreateImportResponseDto } from './dto/create-import-response.dto';
import { GetImportsQueryDto } from './dto/get-imports-query.dto';
import { ImportDetailsDto } from './dto/import-details.dto';
import { RecentImportsResponseDto } from './dto/recent-imports-response.dto';
import { ImportsService } from './imports.service';
import { CsvFileValidationPipe } from './pipes/csv-file-validation.pipe';
import { ParseMongoIdPipe } from './pipes/parse-mongo-id.pipe';

@Controller('imports')
export class ImportsController {
    constructor(private readonly importsService: ImportsService) {}

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    createImport(
        @UploadedFile(CsvFileValidationPipe) file: Express.Multer.File,
    ): Promise<CreateImportResponseDto> {
        return this.importsService.createImportJob(file);
    }

    @Sse(':jobId/events')
    async streamImportEvents(
        @Param('jobId', ParseMongoIdPipe) jobId: string,
    ): Promise<Observable<MessageEvent>> {
        await this.importsService.ensureImportExists(jobId);
        return this.importsService.streamImportEvents(jobId);
    }

    @Get(':jobId')
    getImportById(@Param('jobId', ParseMongoIdPipe) jobId: string): Promise<ImportDetailsDto> {
        return this.importsService.getImportById(jobId);
    }

    @Get()
    getRecentImports(@Query() query: GetImportsQueryDto): Promise<RecentImportsResponseDto> {
        return this.importsService.getRecentImports(query);
    }
}
