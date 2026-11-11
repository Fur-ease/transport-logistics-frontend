'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileBadge, AlertCircle } from 'lucide-react';
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
import { Invoice } from '@/types';
import { formatKES } from '@/lib/formatters';

interface CreditNoteDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreditNoteDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: CreditNoteDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  const cnMutation = useMutation({
    mutationFn: async () => {
      if (!invoice || !amount) return;
      return api.post(`/invoices/${invoice.id}/credit-notes`, {
        amount: Number(amount),
        reason,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Credit note issued successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onOpenChange(false);
      setAmount('');
      setReason('');
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to issue credit note');
    },
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <FileBadge className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Issue Credit Note for {invoice.number}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Correct billed totals downwards (e.g. damages, negotiated discounts) without altering the locked invoice record.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-xl bg-secondary/70 border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Original Invoice Total:</span>
            <span className="font-semibold text-foreground">{formatKES(invoice.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Balance Due:</span>
            <span className="font-semibold text-primary">{formatKES(invoice.balance_due)}</span>
          </div>
        </div>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Credit Amount (KES) *
            </label>
            <Input
              type="number"
              step="10"
              max={invoice.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 15000"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Credit Reason / Justification *
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Compensation for offloading delay & damaged bags"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!amount || Number(amount) <= 0 || !reason.trim() || cnMutation.isPending}
            onClick={() => cnMutation.mutate()}
          >
            {cnMutation.isPending ? 'Issuing...' : 'Issue Credit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

