import { ImportStatus } from '@shared';

export function resolveCompletionStatus(hasErrors: boolean): ImportStatus {
    return hasErrors ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED;
}
