'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FileText,
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatDate } from '@/lib/formatters';
import { Invoice } from '@/types';

const paymentSchema = z.object({
  amount: z.number().min(1, 'Payment amount required'),
  method: z.enum(['mpesa', 'bank', 'cash']),
  reference: z.string().optional(),
  paid_at: z.string().min(1, 'Payment date required'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery<{ data: Invoice[] }>({
    queryKey: ['invoices', statusFilter, search],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { status: statusFilter, search }),
  });

  const invoices = data?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'mpesa',
      paid_at: new Date().toISOString().slice(0, 16),
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (payData: PaymentFormData) =>
      api.post(`/invoices/${selectedInvoice?.id}/payments`, payData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Payment registered successfully');
      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Payment registration failed');
    },
  });

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setValue('amount', invoice.balance_due);
    setPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Customer Payments"
        description="Invoice delivery billing, track payment receipts via M-Pesa or bank transfer, and monitor overdue accounts."
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice number, customer, trip..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'unpaid', 'part_paid', 'paid', 'overdue'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full capitalize font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-primary text-white border-primary font-semibold shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No invoices found"
          description="Invoices are issued from delivered trips."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Invoice #</th>
                <th className="py-3 px-4 text-left font-medium">Customer</th>
                <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                <th className="py-3 px-4 text-right font-medium">Invoice Amount</th>
                <th className="py-3 px-4 text-right font-medium">Total Paid</th>
                <th className="py-3 px-4 text-right font-semibold text-destructive">Balance Due</th>
                <th className="py-3 px-4 text-left font-medium">Due Date</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => {
                const isOverdue = inv.status === 'overdue';

                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      isOverdue ? 'bg-destructive-bg/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {inv.number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {inv.customer?.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {inv.trip ? (
                        <Link href={`/trips/${inv.trip.id}`} className="hover:underline text-foreground">
                          {inv.trip.reference}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <MoneyText amount={inv.amount} size="base" />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-success font-medium">
                      {formatKES(inv.total_paid)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <MoneyText
                        amount={inv.balance_due}
                        variant={inv.balance_due > 0 ? 'negative' : 'muted'}
                        size="base"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={isOverdue ? 'font-bold text-destructive' : 'text-muted-foreground'}>
                        {formatDate(inv.due_date)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inv.status !== 'paid' ? (
                        <Button
                          size="sm"
                          onClick={() => openPaymentModal(inv)}
                          className="h-8 text-xs font-semibold"
                        >
                          <DollarSign className="mr-1 h-3.5 w-3.5" />
                          <span>Record Payment</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-success font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Settled</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment Receipt</DialogTitle>
            <DialogDescription>
              Register cash, M-Pesa paybill, or bank wire for {selectedInvoice?.number}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((d) => paymentMutation.mutate(d))} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-secondary text-xs space-y-1">
              <p className="text-muted-foreground">
                Customer: <span className="font-semibold text-foreground">{selectedInvoice?.customer?.name}</span>
              </p>
              <p className="text-muted-foreground">
                Remaining Balance:{' '}
                <span className="font-mono font-bold text-destructive">
                  {formatKES(selectedInvoice?.balance_due)}
                </span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Payment Method</label>
              <select
                {...register('method')}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="mpesa">M-Pesa (Till / Paybill)</option>
                <option value="bank">Bank Transfer (EFT / RTGS)</option>
                <option value="cash">Cash in Office</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Amount (KES)</label>
              <Input type="number" step="10" {...register('amount', { valueAsNumber: true })} />
              {errors.amount && (
                <p className="text-[11px] text-destructive mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Transaction Reference / Confirmation Code
              </label>
              <Input placeholder="e.g. QHD729SK3 or KCB-RTGS-9821" {...register('reference')} className="font-mono uppercase" />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Payment Date & Time</label>
              <Input type="datetime-local" {...register('paid_at')} />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentModalOpen(false)}
                disabled={paymentMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Recording...' : 'Register Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

