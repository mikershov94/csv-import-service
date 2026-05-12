import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Car, CarDocument } from './entities/car.entity';
import { CarsBulkUpsertResult, CarUpsertInput } from './interfaces/cars.interfaces';
import {
    mapBulkWriteResultToCarsBulkUpsertResult,
    mapCarsToBulkUpsertOperations,
} from './mappers/cars-bulk-upsert.mapper';
import { normalizeCarInput } from './utils/normalize-car-input.util';

@Injectable()
export class CarsService {
    constructor(@InjectModel(Car.name) private readonly carModel: Model<CarDocument>) {}

    async bulkUpsertCars(cars: CarUpsertInput[]): Promise<CarsBulkUpsertResult> {
        if (cars.length === 0) {
            return { insertedCount: 0, updatedCount: 0, processedCount: 0 };
        }

        const normalizedCars = cars.map((car) => normalizeCarInput(car));
        const operations = mapCarsToBulkUpsertOperations(normalizedCars);
        const result = await this.carModel.bulkWrite(operations, { ordered: false });

        return mapBulkWriteResultToCarsBulkUpsertResult(result, normalizedCars.length);
    }
}
