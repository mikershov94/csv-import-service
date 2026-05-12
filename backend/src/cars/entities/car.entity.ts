import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { MAX_YEAR_OFFSET, MIN_YEAR, VIN_REGEX } from '../consts/car-validation.consts';
import { CarStatus } from '../enums/car-status.enum';

export type CarDocument = HydratedDocument<Car>;

@Schema({
    timestamps: true,
    collection: 'cars',
})
export class Car {
    @Prop({
        required: true,
        trim: true,
        uppercase: true,
        minlength: 17,
        maxlength: 17,
        match: VIN_REGEX,
    })
    vin!: string;

    @Prop({
        required: true,
        trim: true,
        minlength: 1,
    })
    make!: string;

    @Prop({
        required: true,
        trim: true,
        minlength: 1,
    })
    model!: string;

    @Prop({
        required: true,
        min: MIN_YEAR,
        validate: {
            validator: (value: number) =>
                Number.isInteger(value) && value <= new Date().getFullYear() + MAX_YEAR_OFFSET,
            message: `year должен быть целым числом между ${MIN_YEAR} и текущим годом + ${MAX_YEAR_OFFSET}`,
        },
    })
    year!: number;

    @Prop({
        required: true,
        min: 0,
        validate: {
            validator: (value: number) => Number.isInteger(value),
            message: 'mileage должен быть неотрицательным целым числом',
        },
    })
    mileage!: number;

    @Prop({
        required: true,
        trim: true,
        minlength: 1,
    })
    dealershipId!: string;

    @Prop({
        required: true,
        enum: CarStatus,
        type: String,
    })
    status!: CarStatus;
}

export const CarSchema = SchemaFactory.createForClass(Car);

CarSchema.index({ vin: 1 }, { unique: true, name: 'uniq_vin' });
