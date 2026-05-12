import { ImportDetailsDto } from '../dto/import-details.dto';
import { ImportErrorSummaryItemDto } from '../dto/import-error-summary-item.dto';
import { ImportListItemDto } from '../dto/import-list-item.dto';
import { ImportDocument } from '../entities/import.entity';

function getCreatedAt(importEntity: ImportDocument): Date {
    const createdAt = importEntity.get('createdAt') as Date | undefined;
    return createdAt ?? new Date();
}

function mapImportToErrorSummaryItemDto(errorItem: {
    code: string;
    message: string;
    count: number;
}): ImportErrorSummaryItemDto {
    return {
        code: errorItem.code,
        message: errorItem.message,
        count: errorItem.count,
    };
}

export function mapImportToListItemDto(importEntity: ImportDocument): ImportListItemDto {
    return {
        jobId: importEntity.id,
        status: importEntity.status,
        fileName: importEntity.fileName,
        fileSizeBytes: importEntity.fileSizeBytes,
        createdAt: getCreatedAt(importEntity).toISOString(),
    };
}

export function mapImportToDetailsDto(importEntity: ImportDocument): ImportDetailsDto {
    return {
        jobId: importEntity.id,
        status: importEntity.status,
        fileName: importEntity.fileName,
        fileSizeBytes: importEntity.fileSizeBytes,
        totalRows: importEntity.totalRows,
        processedRows: importEntity.processedRows,
        successRows: importEntity.successRows,
        failedRows: importEntity.failedRows,
        insertedCount: importEntity.insertedCount,
        updatedCount: importEntity.updatedCount,
        topErrors: importEntity.errorSummary.map((item) => mapImportToErrorSummaryItemDto(item)),
        startedAt: importEntity.startedAt?.toISOString(),
        finishedAt: importEntity.finishedAt?.toISOString(),
        createdAt: getCreatedAt(importEntity).toISOString(),
    };
}
