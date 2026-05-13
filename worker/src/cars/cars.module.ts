import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CarsService } from './cars.service';
import { Car, CarSchema } from './entities/car.entity';

@Module({
    imports: [MongooseModule.forFeature([{ name: Car.name, schema: CarSchema }])],
    providers: [CarsService],
    exports: [CarsService],
})
export class CarsModule {}
