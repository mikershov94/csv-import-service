import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number.parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(Number.isNaN(port) ? 8000 : port);
}
void bootstrap();
