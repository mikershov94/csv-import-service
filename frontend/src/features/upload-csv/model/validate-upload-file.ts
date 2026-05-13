import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/entities/import';

function hasCsvExtension(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.csv');
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

export function validateUploadFile(file: File): string | null {
    if (!hasCsvExtension(file.name)) {
        return 'File must have .csv extension';
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        return `File is too large. Max size is ${formatBytes(MAX_IMPORT_FILE_SIZE_BYTES)}`;
    }

    return null;
}
