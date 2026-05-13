import { CarStatus } from '@shared';

export interface CarUpsertInput {
    vin: string;
    make: string;
    model: string;
    year: number;
    mileage: number;
    dealershipId: string;
    status: CarStatus;
}

export interface CarsBulkUpsertResult {
    insertedCount: number;
    updatedCount: number;
    processedCount: number;
}
