'use client';

import { useState } from 'react';

import { Button, FileDropzone } from '@/shared/ui';
import {
    formatBytes,
    validateUploadFile,
} from '@/widgets/upload-zone/model/validate-upload-file';

type UploadCsvFormProps = {
    onStartImport?: (file: File) => void;
    startButtonLabel?: string;
};

export const UploadCsvForm = ({
    onStartImport,
    startButtonLabel = 'Start import',
}: UploadCsvFormProps) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <div className="flex min-h-44 flex-col gap-4 py-1">
            <FileDropzone
                inputId="upload-zone-input"
                onFileSelect={handleFileSelect}
                errorText={error}
            />
            {selectedFile ? (
                <p className="text-sm text-slate-800">
                    Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
            ) : null}
            <Button
                type="button"
                disabled={!selectedFile}
                onClick={() => selectedFile && onStartImport?.(selectedFile)}
            >
                {startButtonLabel}
            </Button>
        </div>
    );
};
