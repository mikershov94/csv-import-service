import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (!isValidObjectId(value)) {
            throw new BadRequestException('jobId must be a valid MongoObjectId');
        }

        return value;
    }
}
