'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, X, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  className?: string;
  label?: string;
  allowCamera?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = 'image/*,application/pdf',
  className,
  label = 'Attach Receipt or Document',
  allowCamera = true,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    onFileSelect(file);

    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <label className="text-xs font-medium text-foreground block">{label}</label>

      {selectedFile ? (
        <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-card shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="h-12 w-12 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-primary border border-border">
                <FileCheck className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Regular file upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-xl bg-card hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Upload className="h-4 w-4 text-primary" />
            <span>Choose File</span>
          </button>

          {/* Camera capture button for mobile drivers */}
          {allowCamera && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-xl bg-card hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Camera className="h-4 w-4 text-accent" />
              <span>Take Photo</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

