'use client';

import { useState } from 'react';

import { createImport } from '@/entities/import';
import { Button, FileDropzone } from '@/shared/ui';

import { formatBytes, validateUploadFile } from '../model';

type UploadCsvFormProps = {
    onImportCreated?: (jobId: string) => void;
    startButtonLabel?: string;
};

export const UploadCsvForm = ({
    onImportCreated,
    startButtonLabel = 'Начать импорт',
}: UploadCsvFormProps) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileSelect = (file: File) => {
        const validationError = validateUploadFile(file);
        if (validationError) {
            setSelectedFile(null);
            setError(validationError);
            return;
        }

        setSelectedFile(file);
        setError(null);
    };

    const handleStartImport = async () => {
        if (!selectedFile || isSubmitting) {
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);
            const result = await createImport(selectedFile);
            onImportCreated?.(result.jobId);
        } catch (requestError) {
            const message =
                requestError instanceof Error
                    ? requestError.message
                    : 'Не удалось запустить импорт';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-44 flex-col gap-4 py-1">
            <FileDropzone
                inputId="upload-zone-input"
                disabled={isSubmitting}
                onFileSelect={handleFileSelect}
                errorText={error}
            />
            {selectedFile ? (
                <p className="text-sm text-slate-800">
                    Выбран файл: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
            ) : null}
            <Button
                type="button"
                disabled={!selectedFile || isSubmitting}
                onClick={handleStartImport}
            >
                {isSubmitting ? 'Запуск...' : startButtonLabel}
            </Button>
        </div>
    );
};
