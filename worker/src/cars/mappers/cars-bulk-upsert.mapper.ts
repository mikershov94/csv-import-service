import { AnyBulkWriteOperation } from 'mongoose';

import { Car } from '../entities/car.entity';
import { CarsBulkUpsertResult, CarUpsertInput } from '../interfaces/cars.interfaces';

export function mapCarsToBulkUpsertOperations(
    cars: CarUpsertInput[],
): AnyBulkWriteOperation<Car>[] {
    return cars.map((car) => ({
        updateOne: {
            filter: { vin: car.vin },
            update: {
                $set: {
                    make: car.make,
                    model: car.model,
                    year: car.year,
                    mileage: car.mileage,
                    dealershipId: car.dealershipId,
                    status: car.status,
                },
                $setOnInsert: { vin: car.vin },
            },
            upsert: true,
        },
    }));
}

export function mapBulkWriteResultToCarsBulkUpsertResult(
    result: { upsertedCount?: number; modifiedCount?: number },
    processedCount: number,
): CarsBulkUpsertResult {
    const insertedCount = result.upsertedCount ?? 0;
    const modifiedCount = result.modifiedCount ?? 0;
    const updatedCount = Math.max(modifiedCount, processedCount - insertedCount);

    return {
        insertedCount,
        updatedCount,
        processedCount,
    };
}
