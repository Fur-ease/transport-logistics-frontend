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
  FileBadge,
  Ban,
  Eye,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { VoidPaymentDialog } from '@/components/shared/VoidPaymentDialog';
import { CreditNoteDialog } from '@/components/shared/CreditNoteDialog';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
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
import { LIVE_REFETCH_MS, syncFinancialState } from '@/lib/liveSync';
import { formatKES, formatDate, formatDateTime } from '@/lib/formatters';
import { Invoice, Payment } from '@/types';

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

  // Safe editing & audit dialog states
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [detailsModalInvoice, setDetailsModalInvoice] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery<{ data: Invoice[] }>({
    queryKey: ['invoices', statusFilter, search],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { status: statusFilter, search }),
    refetchInterval: LIVE_REFETCH_MS,
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
      syncFinancialState(queryClient);
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{inv.number}</span>
                        {(inv.version ?? 1) > 1 && (
                          <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                            v{inv.version}
                          </span>
                        )}
                        {(inv.total_credited ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            -KES {inv.total_credited?.toLocaleString()} credited
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {inv.status !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => openPaymentModal(inv)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            <DollarSign className="mr-1 h-3.5 w-3.5" />
                            <span>Pay</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCreditNoteInvoice(inv)}
                          className="h-7 px-2 text-xs"
                          title="Issue Credit Note"
                        >
                          <FileBadge className="h-3.5 w-3.5 mr-1" />
                          <span>Credit Note</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailsModalInvoice(inv)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="View Payments, Credit Notes & Audit Trail"
                        >
                          <History className="h-3.5 w-3.5 mr-1" />
                          <span>Details</span>
                        </Button>
                      </div>
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

      {/* Invoice Details, Payments Voiding & Audit Dialog */}
      <Dialog open={!!detailsModalInvoice} onOpenChange={(open) => !open && setDetailsModalInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {detailsModalInvoice?.number} Details</span>
              {detailsModalInvoice && <StatusBadge status={detailsModalInvoice.status} />}
            </DialogTitle>
            <DialogDescription>
              Customer: {detailsModalInvoice?.customer?.name} • Due: {detailsModalInvoice ? formatDate(detailsModalInvoice.due_date) : ''}
            </DialogDescription>
          </DialogHeader>

          {detailsModalInvoice && (
            <div className="space-y-5 py-2 text-xs">
              {/* Financial summary banner */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-secondary/60 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Invoice Total</span>
                  <span className="font-mono font-bold text-sm text-foreground">{formatKES(detailsModalInvoice.amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Valid Paid</span>
                  <span className="font-mono font-bold text-sm text-success">{formatKES(detailsModalInvoice.total_paid)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Balance Due</span>
                  <span className="font-mono font-bold text-sm text-destructive">{formatKES(detailsModalInvoice.balance_due)}</span>
                </div>
              </div>

              {/* Payments Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Payment Entries
                  </span>
                  {detailsModalInvoice.balance_due > 0 && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const inv = detailsModalInvoice;
                        setDetailsModalInvoice(null);
                        openPaymentModal(inv);
                      }}
                    >
                      Record Payment
                    </Button>
                  )}
                </div>

                {!detailsModalInvoice.payments || detailsModalInvoice.payments.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-center bg-secondary/30 rounded-lg">
                    No payment records entered yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2 px-3 text-left">Date</th>
                          <th className="py-2 px-3 text-left">Method / Ref</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-center">Status</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detailsModalInvoice.payments.map((p) => {
                          const isVoided = p.status === 'voided';
                          return (
                            <tr key={p.id} className={isVoided ? 'bg-destructive/5 text-muted-foreground' : ''}>
                              <td className="py-2.5 px-3 font-mono">{formatDateTime(p.paid_at)}</td>
                              <td className="py-2.5 px-3">
                                <span className="uppercase font-medium">{p.method}</span>
                                {p.reference && <span className="block font-mono text-[10px] text-muted-foreground">{p.reference}</span>}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isVoided ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {formatKES(p.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isVoided ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20" title={p.void_reason ?? 'Voided'}>
                                    Voided
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/20">
                                    Valid
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {!isVoided && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                                    onClick={() => setVoidingPayment(p)}
                                    title="Void payment (financial integrity)"
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Void
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Credit Notes Section (if any) */}
              {detailsModalInvoice.credit_notes && detailsModalInvoice.credit_notes.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <FileBadge className="h-4 w-4 text-amber-500" />
                    Credit Notes Issued
                  </span>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2 px-3 text-left">CN Number</th>
                          <th className="py-2 px-3 text-left">Date</th>
                          <th className="py-2 px-3 text-left">Reason</th>
                          <th className="py-2 px-3 text-right">Amount Credited</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detailsModalInvoice.credit_notes.map((cn) => (
                          <tr key={cn.id}>
                            <td className="py-2.5 px-3 font-mono font-semibold text-primary">{cn.number}</td>
                            <td className="py-2.5 px-3">{cn.created_at?.slice(0, 10)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{cn.reason}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600">
                              - {formatKES(cn.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Trail */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <History className="h-4 w-4 text-primary" />
                  Invoice Audit Trail
                </span>
                <HistoryTimeline auditableType="invoice" auditableId={detailsModalInvoice.id} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalInvoice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Note Dialog */}
      <CreditNoteDialog
        invoice={creditNoteInvoice}
        open={!!creditNoteInvoice}
        onOpenChange={(open) => !open && setCreditNoteInvoice(null)}
      />

      {/* Void Payment Dialog */}
      <VoidPaymentDialog
        payment={voidingPayment}
        open={!!voidingPayment}
        onOpenChange={(open) => !open && setVoidingPayment(null)}
        onSuccess={() => {
          setDetailsModalInvoice(null);
        }}
      />
    </div>
  );
}

