import { ImportErrorSummaryItem } from '@shared';

export function mergeErrorSummaryItems(
    currentItems: ImportErrorSummaryItem[],
    deltaItems: ImportErrorSummaryItem[],
): ImportErrorSummaryItem[] {
    const accumulator = new Map<string, ImportErrorSummaryItem>();

    for (const item of currentItems) {
        const key = `${item.code}:${item.message}`;
        accumulator.set(key, { ...item });
    }

    for (const item of deltaItems) {
        const key = `${item.code}:${item.message}`;
        const current = accumulator.get(key);
        if (!current) {
            accumulator.set(key, { ...item });
            continue;
        }

        accumulator.set(key, {
            ...current,
            count: current.count + item.count,
        });
    }

    return Array.from(accumulator.values());
}
