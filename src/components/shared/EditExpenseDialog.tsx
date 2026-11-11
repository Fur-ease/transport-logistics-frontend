'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Receipt, AlertTriangle, AlertCircle, Save, Camera } from 'lucide-react';
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
import { TripExpense } from '@/types';
import { ConcurrencyModal } from './ConcurrencyModal';

const expenseEditSchema = z.object({
  category: z.enum([
    'fuel',
    'allowance',
    'toll',
    'county_levy_cess',
    'border_fees',
    'loading_offloading',
    'repairs',
    'other',
  ]),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  litres: z.number().optional().nullable(),
  odometer_at_fill: z.number().optional().nullable(),
  incurred_at: z.string().min(1, 'Date is required'),
  reason: z.string().optional().nullable(),
});

type ExpenseEditFormData = z.infer<typeof expenseEditSchema>;

interface EditExpenseDialogProps {
  expense: TripExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSuccess,
}: EditExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [concurrencyError, setConcurrencyError] = useState<{
    open: boolean;
    currentVersion?: number;
    conflictFields?: string[];
  }>({ open: false });

  const isApproved = expense?.status === 'approved';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseEditFormData>({
    resolver: zodResolver(expenseEditSchema),
    defaultValues: {
      category: expense?.category ?? 'fuel',
      amount: expense ? Number(expense.amount) : 0,
      litres: expense?.litres ? Number(expense.litres) : null,
      odometer_at_fill: expense?.odometer_at_fill ? Number(expense.odometer_at_fill) : null,
      incurred_at: expense?.incurred_at ? expense.incurred_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
      reason: '',
    },
  });

  useEffect(() => {
    if (expense) {
      reset({
        category: expense.category,
        amount: Number(expense.amount),
        litres: expense.litres ? Number(expense.litres) : null,
        odometer_at_fill: expense.odometer_at_fill ? Number(expense.odometer_at_fill) : null,
        incurred_at: expense.incurred_at ? expense.incurred_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
        reason: '',
      });
    }
  }, [expense, reset]);

  const selectedCategory = watch('category');

  const updateMutation = useMutation({
    mutationFn: async (data: ExpenseEditFormData) => {
      if (!expense) return;
      return api.put(`/expenses/${expense.id}`, {
        ...data,
        version: expense.version ?? 1,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Expense updated successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (expense) {
        queryClient.invalidateQueries({ queryKey: ['trip', expense.trip_id] });
        queryClient.invalidateQueries({ queryKey: ['audit-logs', 'expense', expense.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['advances'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      if (err?.error_code === 'CONCURRENCY_CONFLICT' || err?.status === 409) {
        setConcurrencyError({
          open: true,
          currentVersion: err.current_version,
          conflictFields: err.conflict_fields,
        });
      } else {
        toast.error(err?.message || 'Failed to update expense');
      }
    },
  });

  const onSubmit = (data: ExpenseEditFormData) => {
    updateMutation.mutate(data);
  };

  if (!expense) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold">
                Edit Expense #{expense.id}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Correct expense amount, category, or fuel details.
            </DialogDescription>
          </DialogHeader>

          {/* Re-approval Warning Banner */}
          {isApproved && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span>Re-approval Required</span>
              </div>
              <p className="text-amber-700 dark:text-amber-400 text-[11px]">
                Modifying the amount or category on this approved expense will revert its status to <strong>Pending</strong> for manager re-approval.
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit, (errs) => {
              console.error('Edit expense validation failed:', errs);
              const first = Object.values(errs)[0];
              toast.error(first?.message ? String(first.message) : 'Please check form fields');
            })}
            className="space-y-3.5 py-2"
          >
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Category *</label>
              <select
                {...register('category')}
                className="w-full h-10 px-3 text-sm rounded-lg border border-input bg-card text-foreground"
              >
                <option value="fuel">Fuel (Diesel)</option>
                <option value="allowance">Driver Allowance</option>
                <option value="toll">Highway Toll / Expressway</option>
                <option value="county_levy_cess">County Levy / Cess</option>
                <option value="border_fees">Border Clearing Fees</option>
                <option value="loading_offloading">Loading / Offloading</option>
                <option value="repairs">Emergency En-Route Repairs</option>
                <option value="other">Other Incidentals</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Amount (KES) *</label>
              <Input
                type="number"
                step="1"
                {...register('amount', {
                  setValueAs: (v) => (v === '' || v === undefined ? 0 : Number(v)),
                })}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && <p className="text-[11px] text-destructive mt-1">{errors.amount.message}</p>}
            </div>

            {selectedCategory === 'fuel' && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-secondary/60 border border-border">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Litres</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 120"
                    {...register('litres', {
                      setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
                    })}
                  />
                  {errors.litres && <p className="text-[11px] text-destructive mt-1">{errors.litres.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Odometer at Fill</label>
                  <Input
                    type="number"
                    placeholder="e.g. 142100"
                    {...register('odometer_at_fill', {
                      setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
                    })}
                  />
                  {errors.odometer_at_fill && <p className="text-[11px] text-destructive mt-1">{errors.odometer_at_fill.message}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Date & Time *</label>
              <Input type="datetime-local" {...register('incurred_at')} />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Reason for Edit {isApproved && '*'}
              </label>
              <Input
                placeholder="e.g. Receipt misread or wrong category selected"
                {...register('reason')}
              />
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConcurrencyModal
        open={concurrencyError.open}
        onClose={() => setConcurrencyError({ open: false })}
        serverVersion={concurrencyError.currentVersion}
        conflictFields={concurrencyError.conflictFields}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          onOpenChange(false);
        }}
      />
    </>
  );
}

