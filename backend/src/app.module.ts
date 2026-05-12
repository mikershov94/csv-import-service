import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CarsModule } from './cars/cars.module';
import { ImportsModule } from './imports/imports.module';

@Module({
  imports: [CarsModule, ImportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
