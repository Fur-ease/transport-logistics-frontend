'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, X, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  className?: string;
  label?: string;
  allowCamera?: boolean;
}

export function FileUpload({
  onFilesSelect,
  accept = 'image/*,application/pdf',
  className,
  label = 'Attach Receipts or Documents',
  allowCamera = true,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...prev, ...newFiles.filter((f) => !existing.has(`${f.name}-${f.size}-${f.lastModified}`))];
      onFilesSelect(merged);
      return merged;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addFiles(files);
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onFilesSelect(next);
      return next;
    });
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <label className="text-xs font-medium text-foreground block">{label}</label>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => {
            const isImage = file.type.startsWith('image/');
            const previewUrl = isImage ? URL.createObjectURL(file) : null;
            return (
              <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center justify-between p-3 border border-border rounded-xl bg-card shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Document preview" className="h-12 w-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-primary border border-border">
                      <FileCheck className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(index)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-xl bg-card hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Upload className="h-4 w-4 text-primary" />
          <span>{selectedFiles.length ? 'Add More Files' : 'Choose Files'}</span>
        </button>

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

        <input ref={fileInputRef} type="file" accept={accept} multiple onChange={handleFileChange} className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      </div>

      {selectedFiles.length > 0 && (
        <p className="text-[11px] text-muted-foreground">{selectedFiles.length} file(s) attached. You can add more.</p>
      )}
    </div>
  );
}

