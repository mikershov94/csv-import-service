import { IsDateString, IsEnum, IsInt, IsMongoId, IsNotEmpty, IsString, Min } from 'class-validator';

import { ImportStatus } from '../entities/import.entity';

export class ImportListItemDto {
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

    @IsDateString()
    createdAt!: string;
}
