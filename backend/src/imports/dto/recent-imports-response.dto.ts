import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { ImportListItemDto } from './import-list-item.dto';

export class RecentImportsResponseDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportListItemDto)
    items!: ImportListItemDto[];
}
