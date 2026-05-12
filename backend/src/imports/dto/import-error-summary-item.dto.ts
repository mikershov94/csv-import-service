import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ImportErrorSummaryItemDto {
    @IsString()
    @IsNotEmpty()
    code!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsInt()
    @Min(1)
    count!: number;
}
