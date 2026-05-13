import { CarStatus, ImportErrorSummaryItem, MAX_YEAR_OFFSET, MIN_YEAR, VIN_REGEX } from '@shared';

import { CarUpsertInput } from '../../../cars/interfaces/cars.interfaces';

const IMPORT_ROW_COLUMNS_COUNT = 7;

type ParseImportRowSuccess = {
    ok: true;
    car: CarUpsertInput;
};

type ParseImportRowFailure = {
    ok: false;
    error: ImportErrorSummaryItem;
};

export type ParseImportRowResult = ParseImportRowSuccess | ParseImportRowFailure;

export function parseImportRow(row: string): ParseImportRowResult {
    const columns = row.split(',').map((part) => part.trim());
    if (columns.length !== IMPORT_ROW_COLUMNS_COUNT) {
        return {
            ok: false,
            error: {
                code: 'CSV_COLUMNS_COUNT_INVALID',
                message: `Ожидалось ${IMPORT_ROW_COLUMNS_COUNT} колонок, получено ${columns.length}`,
                count: 1,
            },
        };
    }

    const [vin, make, model, yearRaw, mileageRaw, dealershipId, statusRaw] = columns;
    if (!vin || !make || !model || !yearRaw || !mileageRaw || !dealershipId || !statusRaw) {
        return {
            ok: false,
            error: {
                code: 'CSV_REQUIRED_FIELD_EMPTY',
                message: 'Одна или несколько обязательных колонок пустые',
                count: 1,
            },
        };
    }

    const normalizedVin = vin.toUpperCase();
    if (!VIN_REGEX.test(normalizedVin)) {
        return {
            ok: false,
            error: {
                code: 'CSV_VIN_INVALID',
                message: 'VIN должен быть 17 символов и соответствовать формату',
                count: 1,
            },
        };
    }

    const year = Number.parseInt(yearRaw, 10);
    const maxYear = new Date().getFullYear() + MAX_YEAR_OFFSET;
    if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) {
        return {
            ok: false,
            error: {
                code: 'CSV_YEAR_INVALID',
                message: `year должен быть целым числом от ${MIN_YEAR} до ${maxYear}`,
                count: 1,
            },
        };
    }

    const mileage = Number.parseInt(mileageRaw, 10);
    if (!Number.isInteger(mileage) || mileage < 0) {
        return {
            ok: false,
            error: {
                code: 'CSV_MILEAGE_INVALID',
                message: 'mileage должен быть неотрицательным целым числом',
                count: 1,
            },
        };
    }

    if (!Object.values(CarStatus).includes(statusRaw as CarStatus)) {
        return {
            ok: false,
            error: {
                code: 'CSV_STATUS_INVALID',
                message: `status должен быть одним из: ${Object.values(CarStatus).join(', ')}`,
                count: 1,
            },
        };
    }

    return {
        ok: true,
        car: {
            vin: normalizedVin,
            make,
            model,
            year,
            mileage,
            dealershipId,
            status: statusRaw as CarStatus,
        },
    };
}
