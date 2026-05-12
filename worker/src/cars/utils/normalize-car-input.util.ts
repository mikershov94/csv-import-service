import { CarUpsertInput } from '../interfaces/cars.interfaces';

export function normalizeCarInput(input: CarUpsertInput): CarUpsertInput {
    return {
        ...input,
        vin: input.vin.trim().toUpperCase(),
        make: input.make.trim(),
        model: input.model.trim(),
        dealershipId: input.dealershipId.trim(),
    };
}
