'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Download, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, getAuthToken } from '@/lib/api';

export interface ExportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  scopeDescription: string;
  rowCount: number;
  format: 'pdf' | 'csv';
  scope: 'filtered' | 'all';
  exportEndpoint: string;
  filters?: Record<string, unknown>;
  onExportComplete?: () => void;
}

export function ExportConfirmModal({
  isOpen,
  onClose,
  title,
  scopeDescription,
  rowCount,
  format,
  scope,
  exportEndpoint,
  filters,
  onExportComplete,
}: ExportConfirmModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgressStatus('Submitting export request...');

    try {
      const response = await api.post<{
        status: string;
        message: string;
        export_id: number;
        download_url?: string;
        is_large?: boolean;
      }>(exportEndpoint, {
        format,
        scope,
        filters: filters || {},
      });

      if (response.download_url && !response.is_large) {
        // Direct download available immediately
        setProgressStatus('Export generated successfully!');
        setDownloadUrl(response.download_url);
        window.location.href = response.download_url;
        toast.success(`${format.toUpperCase()} export downloaded successfully`);
        setTimeout(() => {
          setIsExporting(false);
          onExportComplete?.();
          onClose();
        }, 1200);
        return;
      }

      // Large export queued - poll status
      const exportId = response.export_id;
      setProgressStatus('Generating export in background...');

      const pollInterval = setInterval(async () => {
        try {
          const check = await api.get<{
            id: number;
            status: 'queued' | 'processing' | 'ready' | 'failed';
            download_url?: string;
            error_message?: string;
          }>(`/exports/${exportId}`);

          if (check.status === 'ready' && check.download_url) {
            clearInterval(pollInterval);
            setProgressStatus('Ready for download!');
            setDownloadUrl(check.download_url);
            setIsExporting(false);
            window.location.href = check.download_url;
            toast.success(`Export ready and downloading!`);
            onExportComplete?.();
            setTimeout(() => {
              onClose();
            }, 1500);
          } else if (check.status === 'failed') {
            clearInterval(pollInterval);
            setIsExporting(false);
            toast.error(check.error_message || 'Export generation failed.');
          } else if (check.status === 'processing') {
            setProgressStatus('Compiling dataset and generating file...');
          }
        } catch (err: unknown) {
          clearInterval(pollInterval);
          setIsExporting(false);
          toast.error('Failed to poll export status');
        }
      }, 2500);
    } catch (err: unknown) {
      setIsExporting(false);
      setProgressStatus(null);
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setProgressStatus(null);
      setDownloadUrl(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Confirm your export selection
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-secondary/70 p-3.5 border border-border text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Export Format:</span>
              <span className="font-semibold uppercase tracking-wider text-foreground">
                {format} Document
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Data Scope:</span>
              <span className="font-semibold text-foreground">
                {scope === 'all' ? 'Whole Organization Dataset' : 'Current Filtered View'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Estimated Records:</span>
              <span className="font-mono font-bold text-foreground">{rowCount} records</span>
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border/80 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Scope Summary: </span>
            {scopeDescription}
          </div>

          {isExporting && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{progressStatus || 'Processing export...'}</span>
            </div>
          )}

          {downloadUrl && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success-bg border border-success/30 text-xs text-success-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span>File generated! If download didn&apos;t start, <a href={downloadUrl} className="underline font-bold">click here</a>.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStartExport}
            disabled={isExporting || rowCount === 0}
            className="gap-1.5"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Confirm &amp; Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

