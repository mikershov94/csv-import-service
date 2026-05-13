import { isObject } from './is-object.guard';

export function extractJobIdFromPayload(rawPayload: string): string | undefined {
    try {
        const parsed = JSON.parse(rawPayload) as unknown;
        if (!isObject(parsed)) {
            return undefined;
        }

        const maybeJobId = parsed.jobId;
        return typeof maybeJobId === 'string' ? maybeJobId : undefined;
    } catch {
        return undefined;
    }
}
