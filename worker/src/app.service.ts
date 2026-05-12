import { Injectable } from '@nestjs/common';
import { ImportStatus } from '@shared';

@Injectable()
export class AppService {
    getHello(): string {
        return 'Hello World!';
    }

    getHealth(): { status: string } {
        return { status: 'ok' };
    }

    getSupportedImportStatuses(): ImportStatus[] {
        return [
            ImportStatus.QUEUED,
            ImportStatus.PROCESSING,
            ImportStatus.COMPLETED,
            ImportStatus.COMPLETED_WITH_ERRORS,
            ImportStatus.FAILED,
        ];
    }
}
