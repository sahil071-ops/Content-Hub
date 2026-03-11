'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, formatFileSize } from '@/lib/utils';

interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
  file: File | null;
  onClear: () => void;
  uploadProgress?: number;
  disabled?: boolean;
}

export function UploadZone({ onFileAccepted, file, onClear, uploadProgress, disabled }: UploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileAccepted(acceptedFiles[0]);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: disabled || !!file,
  });

  if (file) {
    return (
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          {uploadProgress !== undefined ? (
            <div className="w-24">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-1">{uploadProgress}%</p>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className={cn('h-10 w-10 mb-3', isDragActive ? 'text-primary' : 'text-muted-foreground/50')} />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">Drop your file here</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Drag & drop a file here, or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG, PSD, PPT, PPTX, DOC, DOCX, HTML · Max 500 MB
            </p>
          </>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="flex items-start gap-2 mt-2 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {fileRejections[0].errors[0].code === 'file-too-large'
              ? `File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`
              : fileRejections[0].errors[0].message}
          </span>
        </div>
      )}
    </div>
  );
}
