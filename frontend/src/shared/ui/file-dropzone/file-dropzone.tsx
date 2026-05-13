'use client';

import { ChangeEvent, DragEvent, useState } from 'react';

import { Button } from '@/shared/ui/button';
import { FileInput } from '@/shared/ui/file-input';
import { Label } from '@/shared/ui/label';

type FileDropzoneProps = {
    inputId: string;
    disabled?: boolean;
    errorText?: string | null;
    onFileSelect?: (file: File) => void;
    className?: string;
};

export const FileDropzone = ({
    inputId,
    disabled,
    errorText,
    onFileSelect,
    className,
}: FileDropzoneProps) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        onFileSelect?.(file);
        event.target.value = '';
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) {
            return;
        }
        setIsDragActive(false);
        const file = event.dataTransfer.files?.[0];
        if (!file) {
            return;
        }
        onFileSelect?.(file);
    };

    const openFileDialog = () => {
        if (disabled) {
            return;
        }
        const input = document.getElementById(inputId);
        if (input instanceof HTMLInputElement) {
            input.click();
        }
    };

    const dropzoneStateClass = isDragActive
        ? 'border-slate-700 bg-white/70'
        : 'border-slate-500/50 bg-white/45';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={openFileDialog}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openFileDialog();
                }
            }}
            onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!disabled) {
                    setIsDragActive(true);
                }
            }}
            onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!disabled) {
                    setIsDragActive(true);
                }
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragActive(false);
            }}
            onDrop={handleDrop}
            className={`flex min-h-32 flex-col items-start justify-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${dropzoneStateClass} ${className ?? ''}`}
        >
            <Label htmlFor={inputId}>Выберите CSV-файл</Label>
            <FileInput
                id={inputId}
                disabled={disabled}
                onChange={handleInputChange}
                className="sr-only"
            />
            <Button type="button" variant="secondary" disabled={disabled}>
                Обзор
            </Button>
            {errorText ? <p className="text-sm text-red-700">{errorText}</p> : null}
        </div>
    );
};
