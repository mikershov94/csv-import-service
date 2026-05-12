import { IsEnum, IsInt, IsMongoId, Min } from 'class-validator';

import { ImportStatus } from '../entities/import.entity';

export class ImportProgressEventDto {
    @IsMongoId()
    jobId!: string;

    @IsEnum(ImportStatus)
    status!: ImportStatus;

    @IsInt()
    @Min(0)
    processedBytes!: number;

    @IsInt()
    @Min(0)
    validRows!: number;

    @IsInt()
    @Min(0)
    invalidRows!: number;
}
