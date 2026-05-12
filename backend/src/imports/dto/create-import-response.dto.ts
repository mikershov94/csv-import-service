import { IsInt, IsMongoId, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateImportResponseDto {
    @IsMongoId()
    jobId!: string;

    @IsString()
    @IsNotEmpty()
    fileName!: string;

    @IsInt()
    @Min(0)
    fileSizeBytes!: number;
}
