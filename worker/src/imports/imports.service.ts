import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ImportErrorSummaryItem, ImportStatus } from '@shared';
import { Model } from 'mongoose';

import { Import, ImportDocument } from './entities/import.entity';
import { ImportCompletionResult, ImportProgressDelta } from './interfaces/imports.interfaces';
import {
    mapMarkProcessingUpdate,
    mapProgressDeltaToIncUpdate,
} from './mappers/imports-update.mapper';
import { mergeErrorSummaryItems } from './utils/merge-error-summary-items.util';
import { resolveCompletionStatus } from './utils/resolve-completion-status.util';

@Injectable()
export class ImportsService {
    constructor(@InjectModel(Import.name) private readonly importModel: Model<ImportDocument>) {}

    async markProcessing(jobId: string): Promise<void> {
        await this.importModel
            .updateOne(
                { _id: jobId },
                {
                    $set: mapMarkProcessingUpdate(),
                },
            )
            .exec();
    }

    async applyProgress(jobId: string, delta: ImportProgressDelta): Promise<void> {
        const importEntity = await this.importModel.findById(jobId).exec();
        if (!importEntity) {
            return;
        }

        const currentErrorSummary = importEntity.errorSummary ?? [];
        const deltaErrorSummary = delta.errorItems ?? [];
        const mergedErrorSummary = mergeErrorSummaryItems(currentErrorSummary, deltaErrorSummary);

        await this.importModel
            .updateOne(
                { _id: jobId },
                {
                    $inc: mapProgressDeltaToIncUpdate(delta),
                    $set: { errorSummary: mergedErrorSummary },
                },
            )
            .exec();
    }

    async markCompleted(jobId: string, hasErrors: boolean): Promise<ImportCompletionResult> {
        const status = resolveCompletionStatus(hasErrors);
        const finishedAt = new Date();

        await this.importModel
            .updateOne(
                { _id: jobId },
                {
                    $set: {
                        status,
                        finishedAt,
                    },
                },
            )
            .exec();

        return { status, finishedAt };
    }

    async markFailed(jobId: string, message: string, code = 'WORKER_ERROR'): Promise<void> {
        const importEntity = await this.importModel.findById(jobId).exec();
        if (!importEntity) {
            return;
        }

        const failedErrorItem: ImportErrorSummaryItem = {
            code,
            message,
            count: 1,
        };
        const mergedErrorSummary = mergeErrorSummaryItems(importEntity.errorSummary ?? [], [
            failedErrorItem,
        ]);

        await this.importModel
            .updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: ImportStatus.FAILED,
                        finishedAt: new Date(),
                        errorSummary: mergedErrorSummary,
                    },
                },
            )
            .exec();
    }
}
