import { ImportStatus } from '@shared';
import { Model } from 'mongoose';

import { ImportDocument } from './entities/import.entity';
import { ImportsService } from './imports.service';

type MockedModel = Partial<Record<keyof Model<ImportDocument>, jest.Mock>>;
const JOB_ID = 'job-1';
const VIN_ERROR = { code: 'CSV_VIN_INVALID', message: 'bad vin', count: 1 };
const PROGRESS_DELTA = {
    processedRows: 2,
    successRows: 1,
    failedRows: 1,
    insertedCount: 1,
    updatedCount: 0,
};

describe('ImportsService', () => {
    let service: ImportsService;
    let importModel: MockedModel;

    beforeEach(() => {
        importModel = {
            findById: jest.fn(),
            updateOne: jest.fn(),
        };
        service = new ImportsService(importModel as unknown as Model<ImportDocument>);
    });

    it('applyProgress объединяет error summary и инкрементирует счётчики', async () => {
        const existingImport = {
            errorSummary: [VIN_ERROR],
        };
        const findExec = jest.fn().mockResolvedValue(existingImport);
        const updateExec = jest.fn().mockResolvedValue(undefined);

        importModel.findById?.mockReturnValue({ exec: findExec });
        importModel.updateOne?.mockReturnValue({ exec: updateExec });

        await service.applyProgress(JOB_ID, {
            ...PROGRESS_DELTA,
            errorItems: [{ code: 'CSV_VIN_INVALID', message: 'bad vin', count: 2 }],
        });

        expect(importModel.updateOne).toHaveBeenCalledWith(
            { _id: JOB_ID },
            {
                $inc: PROGRESS_DELTA,
                $set: {
                    errorSummary: [{ code: 'CSV_VIN_INVALID', message: 'bad vin', count: 3 }],
                },
            },
        );
    });

    it('hasErrors возвращает true, когда failedRows больше нуля', async () => {
        const exec = jest.fn().mockResolvedValue({ failedRows: 1, errorSummary: [] });
        const lean = jest.fn().mockReturnValue({ exec });
        const select = jest.fn().mockReturnValue({ lean });
        importModel.findById?.mockReturnValue({ select });

        await expect(service.hasErrors('job-2')).resolves.toBe(true);
    });

    it('markCompleted выставляет completed_with_errors при hasErrors=true', async () => {
        const updateExec = jest.fn().mockResolvedValue(undefined);
        importModel.updateOne?.mockReturnValue({ exec: updateExec });

        const result = await service.markCompleted('job-3', true);

        expect(importModel.updateOne).toHaveBeenCalled();
        const updateOneCalls = importModel.updateOne?.mock.calls as unknown as Array<
            [{ _id: string }, { $set: { status: ImportStatus; finishedAt: Date } }]
        >;
        const [query, update] = updateOneCalls[0];

        expect(query).toEqual({ _id: 'job-3' });
        expect(update.$set.status).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
        expect(update.$set.finishedAt).toBeInstanceOf(Date);
        expect(result.status).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
    });
});
