import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

import { ImportStatus } from '../entities/import.entity';
import { ImportErrorSummaryItemDto } from './import-error-summary-item.dto';

export class ImportDetailsDto {
    @IsMongoId()
    jobId!: string;

    @IsEnum(ImportStatus)
    status!: ImportStatus;

    @IsString()
    @IsNotEmpty()
    fileName!: string;

    @IsInt()
    @Min(0)
    fileSizeBytes!: number;

    @IsInt()
    @Min(0)
    totalRows!: number;

    @IsInt()
    @Min(0)
    processedRows!: number;

    @IsInt()
    @Min(0)
    successRows!: number;

    @IsInt()
    @Min(0)
    failedRows!: number;

    @IsInt()
    @Min(0)
    insertedCount!: number;

    @IsInt()
    @Min(0)
    updatedCount!: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportErrorSummaryItemDto)
    topErrors!: ImportErrorSummaryItemDto[];

    @IsOptional()
    @IsDateString()
    startedAt?: string;

    @IsOptional()
    @IsDateString()
    finishedAt?: string;

    @IsDateString()
    createdAt!: string;
}
