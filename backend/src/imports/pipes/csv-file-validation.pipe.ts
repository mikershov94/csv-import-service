import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { ALLOWED_CSV_MIME_TYPES, MAX_IMPORT_FILE_SIZE_BYTES } from '../consts/import-file.consts';

@Injectable()
export class CsvFileValidationPipe implements PipeTransform<
    Express.Multer.File | undefined,
    Express.Multer.File
> {
    transform(file: Express.Multer.File | undefined): Express.Multer.File {
        if (!file) {
            throw new BadRequestException('Файл обязателен');
        }

        const isCsvByExtension = file.originalname.toLowerCase().endsWith('.csv');
        const isCsvByMimeType = ALLOWED_CSV_MIME_TYPES.has(file.mimetype);

        if (!isCsvByExtension || !isCsvByMimeType) {
            throw new BadRequestException('Файл должен быть в формате CSV');
        }

        if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
            throw new BadRequestException(
                `Размер файла должен быть не больше ${MAX_IMPORT_FILE_SIZE_BYTES} байт`,
            );
        }

        return file;
    }
}
