'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Scale, Plus, Minus } from 'lucide-react';
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
import { DriverAdvance } from '@/types';
import { formatKES } from '@/lib/formatters';

interface AdvanceAdjustmentDialogProps {
  advance: DriverAdvance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AdvanceAdjustmentDialog({
  advance,
  open,
  onOpenChange,
  onSuccess,
}: AdvanceAdjustmentDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'additional_advance' | 'reversal_credit'>('additional_advance');
  const [reason, setReason] = useState('');

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!advance || !amount) return;
      return api.post(`/advances/${advance.id}/adjust`, {
        amount: Number(amount),
        type,
        reason,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Advance adjustment registered successfully');
      syncFinancialState(queryClient);
      onOpenChange(false);
      setAmount('');
      setReason('');
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to register adjustment');
    },
  });

  if (!advance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <Scale className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Adjust Settled Advance #{advance.id}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Settled advances cannot have their initial amount overwritten. Post an adjustment entry to maintain full settlement accounting.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-xl bg-secondary/70 border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Original Advance Given:</span>
            <span className="font-semibold text-foreground">{formatKES(advance.amount_given)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Net Balance:</span>
            <span className="font-semibold text-primary">{formatKES(advance.balance_remaining)}</span>
          </div>
        </div>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Adjustment Type *
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setType('additional_advance')}
                className={`p-2.5 rounded-lg border text-left font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                  type === 'additional_advance'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <div>
                  <div>Supplementary</div>
                  <div className="text-[10px] text-muted-foreground font-normal">Add extra advance</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('reversal_credit')}
                className={`p-2.5 rounded-lg border text-left font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                  type === 'reversal_credit'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <Minus className="h-4 w-4 shrink-0" />
                <div>
                  <div>Reversal Credit</div>
                  <div className="text-[10px] text-muted-foreground font-normal">Reduce advance</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Adjustment Amount (KES) *
            </label>
            <Input
              type="number"
              step="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 5000"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Reason / Explanation *
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Emergency allowance topped up via M-PESA"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!amount || Number(amount) <= 0 || !reason.trim() || adjustMutation.isPending}
            onClick={() => adjustMutation.mutate()}
          >
            {adjustMutation.isPending ? 'Saving...' : 'Post Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

