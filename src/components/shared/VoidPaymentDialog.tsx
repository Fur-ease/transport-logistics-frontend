'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { syncFinancialState } from '@/lib/liveSync';
import { Payment } from '@/types';
import { formatKES, formatDateTime } from '@/lib/formatters';

interface VoidPaymentDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VoidPaymentDialog({
  payment,
  open,
  onOpenChange,
  onSuccess,
}: VoidPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!payment) return;
      return api.post(`/payments/${payment.id}/void`, { reason });
    },
    onSuccess: async (res: any) => {
      toast.success(res?.message || 'Payment voided successfully');
      await syncFinancialState(queryClient);
      onOpenChange(false);
      setReason('');
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to void payment');
    },
  });

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-destructive-bg text-destructive flex items-center justify-center mb-1">
            <Ban className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Void Payment of {formatKES(payment.amount)}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Direct editing or hard deletion of payments is prohibited. Voiding will reverse the recorded amount, restore the invoice balance due, and record an audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-xl bg-secondary/70 border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="font-semibold text-foreground uppercase">{payment.method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference:</span>
            <span className="font-mono text-foreground">{payment.reference || 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid At:</span>
            <span className="text-foreground">{formatDateTime(payment.paid_at)}</span>
          </div>
        </div>

        <div className="space-y-1.5 py-2">
          <label className="text-xs font-semibold text-foreground block">
            Reason for voiding payment *
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Cheque bounced or duplicate M-PESA entry"
            className="bg-card"
          />
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!reason.trim() || voidMutation.isPending}
            onClick={() => voidMutation.mutate()}
          >
            {voidMutation.isPending ? 'Voiding...' : 'Confirm Void Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

