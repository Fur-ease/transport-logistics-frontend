'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ConcurrencyModalProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  serverVersion?: number;
  conflictFields?: string[];
  message?: string;
}

export function ConcurrencyModal({
  open,
  onClose,
  onRefresh,
  serverVersion,
  conflictFields = [],
  message = 'Another team member modified this record while you were editing it.',
}: ConcurrencyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Concurrent Edit Conflict (Version {serverVersion ?? 'Newer'})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {message}
          </DialogDescription>
        </DialogHeader>

        {conflictFields.length > 0 && (
          <div className="py-2">
            <p className="text-xs font-semibold text-foreground mb-1.5">
              Conflicting Fields Detected:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {conflictFields.map((field) => (
                <span
                  key={field}
                  className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[11px]"
                >
                  {field}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              To preserve financial integrity and avoid accidental data overwrite, please refresh to load the latest server version before reapplying your edits.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2 pt-3">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Latest Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

