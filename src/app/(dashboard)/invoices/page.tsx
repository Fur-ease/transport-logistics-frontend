'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FileText,
  DollarSign,
  Search,
  FileBadge,
  Ban,
  History,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  Copy,
  Building2,
  Download,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { VoidPaymentDialog } from '@/components/shared/VoidPaymentDialog';
import { CreditNoteDialog } from '@/components/shared/CreditNoteDialog';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { StatCard } from '@/components/shared/StatCard';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, openProtectedFile } from '@/lib/api';
import { LIVE_REFETCH_MS, syncFinancialState } from '@/lib/liveSync';
import { formatKES, formatDate, formatDateTime } from '@/lib/formatters';
import { Invoice, Payment, Customer } from '@/types';

const paymentSchema = z.object({
  amount: z.number().min(1, 'Payment amount required'),
  method: z.enum(['mpesa', 'bank', 'cash']),
  reference: z.string().optional(),
  bank_name: z.string().optional(),
  cheque_number: z.string().optional(),
  transaction_code: z.string().optional(),
  payer_name: z.string().optional(),
  notes: z.string().optional(),
  paid_at: z.string().min(1, 'Payment date required'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface InvoiceListResponse {
  data: Invoice[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  stats?: Record<string, number>;
  summary?: { total_amount: number; total_paid: number; total_credited: number; outstanding: number };
}

const statusOptions = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'part_paid', label: 'Part Paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState('due_date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [detailsModalInvoice, setDetailsModalInvoice] = useState<Invoice | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [statusFilter, customerFilter, fromDate, toDate, sort, direction, perPage]);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<InvoiceListResponse>({
    queryKey: ['invoices', statusFilter, search, customerFilter, fromDate, toDate, sort, direction, page, perPage],
    queryFn: () => api.get<InvoiceListResponse>('/invoices', {
      status: statusFilter, search,
      customer_id: customerFilter || undefined,
      from: fromDate || undefined, to: toDate || undefined,
      sort, direction, page, per_page: perPage,
    }),
    refetchInterval: LIVE_REFETCH_MS,
  });

  const { data: customersData } = useQuery<{ data: Customer[] }>({
    queryKey: ['customers-select-invoices'],
    queryFn: () => api.get<{ data: Customer[] }>('/customers', { per_page: 200 } as any),
  });

  const invoices = data?.data || [];
  const stats = data?.stats;
  const summary = data?.summary;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'mpesa' },
  });
  const selectedMethod = watch('method');

  const paymentMutation = useMutation({
    mutationFn: (payData: PaymentFormData) => {
      const fd = new FormData();
      fd.append('amount', String(payData.amount));
      fd.append('method', payData.method);
      fd.append('paid_at', payData.paid_at);
      if (payData.reference) fd.append('reference', payData.reference);
      if (payData.bank_name) fd.append('bank_name', payData.bank_name);
      if (payData.cheque_number) fd.append('cheque_number', payData.cheque_number);
      if (payData.transaction_code) fd.append('transaction_code', payData.transaction_code);
      if (payData.payer_name) fd.append('payer_name', payData.payer_name);
      if (payData.notes) fd.append('notes', payData.notes);
      if (paymentProof) fd.append('proof', paymentProof);
      return api.upload(`/invoices/${selectedInvoice?.id}/payments`, fd);
    },
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Payment registered successfully');
      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPaymentProof(null);
      reset({ method: 'mpesa' });
    },
    onError: (err: Error) => toast.error(err.message || 'Payment registration failed'),
  });

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentProof(null);
    reset({ method: 'mpesa', amount: undefined as any, paid_at: '', reference: '', bank_name: '', cheque_number: '', transaction_code: '', payer_name: '', notes: '' });
    setPaymentModalOpen(true);
  };

  const hasActiveFilters = statusFilter !== 'all' || search || customerFilter || fromDate || toDate;
  const resetFilters = () => {
    setStatusFilter('all'); setSearchInput(''); setSearch('');
    setCustomerFilter(''); setFromDate(''); setToDate('');
    setSort('due_date'); setDirection('asc');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Billing"
        description="Real-time invoice tracking, payments, credit notes and receivables. All amounts in KES."
        actions={
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 px-2 text-xs">
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-success" /></span>
          Live billing data • auto-refresh every 15s{dataUpdatedAt ? ` • updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Invoices" value={data?.total ?? 0} subtitle={`${stats?.overdue ?? 0} overdue`} icon={<FileText className="h-4 w-4" />} />
        <StatCard title="Total Invoiced" value={formatKES(summary?.total_amount ?? 0)} subtitle="Filtered set" icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="Total Received" value={formatKES(summary?.total_paid ?? 0)} subtitle="Valid payments" icon={<DollarSign className="h-4 w-4" />} valueClassName="text-success font-semibold" />
        <StatCard title="Credit Notes" value={formatKES(summary?.total_credited ?? 0)} subtitle="Applied credits" icon={<FileBadge className="h-4 w-4" />} />
        <StatCard title="Outstanding" value={formatKES(summary?.outstanding ?? 0)} subtitle="Invoiced - paid - credits" icon={<FileBadge className="h-4 w-4" />} valueClassName={(summary?.outstanding ?? 0) > 0 ? 'text-destructive font-semibold' : undefined} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice #, customer, trip..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9 h-9 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(v => !v)} className="h-9 text-xs">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filters {hasActiveFilters && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            {hasActiveFilters && <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs">Clear</Button>}
          </div>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl border border-border bg-card">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Customer</label>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground">
                <option value="">All customers</option>
                {customersData?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">From (Due Date)</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">To (Due Date)</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Sort</label>
                <select value={sort} onChange={e => setSort(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-input bg-card text-xs">
                  <option value="due_date">Due date</option>
                  <option value="created_at">Created</option>
                  <option value="amount">Amount</option>
                  <option value="number">Number</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Order</label>
                <select value={direction} onChange={e => setDirection(e.target.value as 'asc'|'desc')} className="w-full h-9 px-2 rounded-lg border border-input bg-card text-xs">
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {statusOptions.map(st => {
            const count = st.key === 'all' ? stats?.all : stats?.[st.key];
            return (
              <button key={st.key} onClick={() => setStatusFilter(st.key)} className={`px-3 py-1.5 rounded-full font-medium transition-colors border whitespace-nowrap ${statusFilter === st.key ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                {st.label}{typeof count === 'number' && <span className={`ml-1.5 tabular-nums ${statusFilter === st.key ? 'text-white/80' : ''}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices found" description={hasActiveFilters ? 'No invoices match current filters.' : 'Invoices are issued from delivered trips.'} actionLabel={hasActiveFilters ? 'Clear Filters' : undefined} onAction={hasActiveFilters ? resetFilters : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Invoice #</th>
                <th className="py-3 px-4 text-left font-medium">Customer</th>
                <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                <th className="py-3 px-4 text-right font-medium">Amount</th>
                <th className="py-3 px-4 text-right font-medium">Paid</th>
                <th className="py-3 px-4 text-right font-semibold text-destructive">Balance</th>
                <th className="py-3 px-4 text-left font-medium">Due Date</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map(inv => {
                const isOverdue = inv.status === 'overdue';
                return (
                  <tr key={inv.id} className={`hover:bg-muted/40 transition-colors ${isOverdue ? 'bg-destructive-bg/20' : ''}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => setDetailsModalInvoice(inv)} className="hover:underline">{inv.number}</button>
                        {(inv.version ?? 1) > 1 && <span className="text-[10px] px-1.5 rounded bg-primary/10 text-primary border border-primary/20">v{inv.version}</span>}
                        {(inv.total_credited ?? 0) > 0 && <span className="text-[10px] font-semibold px-1.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">-{formatKES(inv.total_credited)}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {inv.customer?.name}
                      {inv.customer?.id && <Link href={`/customers`} className="ml-1 text-[11px] text-muted-foreground hover:text-primary">(view)</Link>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {inv.trip ? <Link href={`/trips/${inv.trip.id}`} className="hover:underline text-foreground">{inv.trip.reference}</Link> : 'â€”'}
                    </td>
                    <td className="py-3.5 px-4 text-right"><MoneyText amount={inv.amount} size="base" /></td>
                    <td className="py-3.5 px-4 text-right"><span className="font-mono text-xs tabular-nums text-success font-medium">{formatKES(inv.total_paid)}</span></td>
                    <td className="py-3.5 px-4 text-right"><MoneyText amount={inv.balance_due} variant={inv.balance_due > 0 ? 'negative' : 'muted'} size="base" /></td>
                    <td className="py-3.5 px-4 text-xs"><span className={isOverdue ? 'font-bold text-destructive' : 'text-muted-foreground'}>{formatDate(inv.due_date)}</span></td>
                    <td className="py-3.5 px-4 text-center"><StatusBadge status={inv.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setDetailsModalInvoice(inv)} className="gap-2"><History className="h-3.5 w-3.5" />Details & audit</DropdownMenuItem>
                          {inv.trip && <DropdownMenuItem asChild><Link href={`/trips/${inv.trip.id}`} className="flex items-center gap-2"><ArrowUpRight className="h-3.5 w-3.5" />Open trip</Link></DropdownMenuItem>}
                          {inv.status !== 'paid' && <DropdownMenuItem onClick={() => openPaymentModal(inv)} className="gap-2"><DollarSign className="h-3.5 w-3.5" />Record payment</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setCreditNoteInvoice(inv)} className="gap-2"><FileBadge className="h-3.5 w-3.5" />Issue credit note</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(inv.number)} className="gap-2"><Copy className="h-3.5 w-3.5" />Copy invoice #</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{data.from ?? 0}</span>â€“<span className="font-semibold text-foreground">{data.to ?? 0}</span> of <span className="font-semibold text-foreground">{data.total}</span> invoices</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Rows</label>
            <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-input bg-card text-xs">{[10,15,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}</select>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={data.current_page <= 1} onClick={() => setPage(p => Math.max(1,p-1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Page <span className="font-semibold text-foreground">{data.current_page}</span> of <span className="font-semibold text-foreground">{data.last_page}</span></span>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={data.current_page >= data.last_page} onClick={() => setPage(p => Math.min(data.last_page,p+1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      <Dialog open={paymentModalOpen} onOpenChange={(o) => { setPaymentModalOpen(o); if (!o) { setPaymentProof(null); reset({ method: 'mpesa' }); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Capture payment method, proof, and references for {selectedInvoice?.number}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => paymentMutation.mutate(d))} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-secondary text-xs space-y-1">
              <p className="text-muted-foreground">Customer: <span className="font-semibold text-foreground">{selectedInvoice?.customer?.name}</span></p>
              <p className="text-muted-foreground">Remaining Balance: <span className="font-mono font-bold text-destructive">{formatKES(selectedInvoice?.balance_due)}</span></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Payment Method</label>
                <select {...register('method')} className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm">
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank / Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Amount (KES)</label>
                <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-[11px] text-destructive mt-1">{errors.amount.message}</p>}
              </div>
            </div>
            {(selectedMethod === 'bank') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-foreground block mb-1">Bank Name</label><Input placeholder="e.g. KCB, Equity" {...register('bank_name')} /></div>
                <div><label className="text-xs font-semibold text-foreground block mb-1">Cheque No.</label><Input placeholder="Cheque number" {...register('cheque_number')} className="font-mono" /></div>
              </div>
            )}
            {(selectedMethod === 'mpesa' || selectedMethod === 'bank') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-foreground block mb-1">{selectedMethod === 'mpesa' ? 'M-Pesa Code' : 'Transaction / Ref No.'}</label><Input placeholder={selectedMethod === 'mpesa' ? 'e.g. QHD729SK3' : 'Bank reference'} {...register('transaction_code')} className="font-mono uppercase" /></div>
                <div><label className="text-xs font-semibold text-foreground block mb-1">Payer / Paid By</label><Input placeholder="Name on payment" {...register('payer_name')} /></div>
              </div>
            )}
            {selectedMethod === 'cash' && (
              <div><label className="text-xs font-semibold text-foreground block mb-1">Payer / Received From</label><Input placeholder="Name" {...register('payer_name')} /></div>
            )}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Receipt / Reference</label>
              <Input placeholder="Internal reference or receipt no." {...register('reference')} className="font-mono uppercase" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Payment Proof (receipt, cheque slip, screenshot)</label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setPaymentProof(e.target.files?.[0] || null)} className="text-xs" />
              {paymentProof && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Paperclip className="h-3 w-3" />{paymentProof.name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Payment Date & Time</label>
              <Input type="datetime-local" {...register('paid_at')} />
              {errors.paid_at && <p className="text-[11px] text-destructive mt-1">{errors.paid_at.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
              <Input placeholder="Optional notes" {...register('notes')} />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => { setPaymentModalOpen(false); setPaymentProof(null); }} disabled={paymentMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={paymentMutation.isPending}>{paymentMutation.isPending ? 'Recording...' : 'Register Payment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsModalInvoice} onOpenChange={(open) => !open && setDetailsModalInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between"><span>Invoice {detailsModalInvoice?.number}</span>{detailsModalInvoice && <StatusBadge status={detailsModalInvoice.status} />}</DialogTitle>
            <DialogDescription>Customer: {detailsModalInvoice?.customer?.name} • Due: {detailsModalInvoice ? formatDate(detailsModalInvoice.due_date) : ''}</DialogDescription>
          </DialogHeader>
          {detailsModalInvoice && (
            <div className="space-y-5 py-2 text-xs">
              <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-secondary/60 border border-border">
                <div><span className="text-muted-foreground block text-[11px]">Invoice Total</span><span className="font-mono font-bold text-sm text-foreground">{formatKES(detailsModalInvoice.amount)}</span></div>
                <div><span className="text-muted-foreground block text-[11px]">Valid Paid</span><span className="font-mono font-bold text-sm text-success">{formatKES(detailsModalInvoice.total_paid)}</span></div>
                <div><span className="text-muted-foreground block text-[11px]">Credit Notes</span><span className="font-mono font-bold text-sm text-foreground">{formatKES(detailsModalInvoice.total_credited ?? 0)}</span></div>
                <div><span className="text-muted-foreground block text-[11px]">Balance Due</span><span className="font-mono font-bold text-sm text-destructive">{formatKES(detailsModalInvoice.balance_due)}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className="font-semibold text-foreground text-sm flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-primary" />Payment Entries</span>
                  {detailsModalInvoice.balance_due > 0 && <Button size="sm" className="h-7 text-xs" onClick={() => { const inv = detailsModalInvoice; setDetailsModalInvoice(null); openPaymentModal(inv); }}>Record Payment</Button>}</div>
                {!detailsModalInvoice.payments?.length ? <p className="text-muted-foreground p-3 text-center bg-secondary/30 rounded-lg">No payment records entered yet.</p> : (
                  <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="bg-secondary/60 text-muted-foreground border-b border-border"><tr><th className="py-2 px-3 text-left">Date</th><th className="py-2 px-3 text-left">Method / Details</th><th className="py-2 px-3 text-left">Proof</th><th className="py-2 px-3 text-right">Amount</th><th className="py-2 px-3 text-center">Status</th><th className="py-2 px-3 text-right">Action</th></tr></thead>
                    <tbody className="divide-y divide-border">{detailsModalInvoice.payments.map(p => { const isVoided = p.status === 'voided'; const details = [p.bank_name && `Bank: ${p.bank_name}`, p.cheque_number && `Cheque: ${p.cheque_number}`, p.transaction_code && `Txn: ${p.transaction_code}`, p.payer_name && `Payer: ${p.payer_name}`, p.reference && `Ref: ${p.reference}`].filter(Boolean) as string[]; return (
                      <tr key={p.id} className={isVoided ? 'bg-destructive/5 text-muted-foreground' : ''}>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">{formatDateTime(p.paid_at)}</td>
                        <td className="py-2.5 px-3"><span className="uppercase font-medium">{p.method}</span>{details.length > 0 && <span className="block text-[10px] text-muted-foreground mt-0.5">{details.join(' • ')}</span>}{p.notes && <span className="block text-[10px] text-muted-foreground">{p.notes}</span>}</td>
                        <td className="py-2.5 px-3">{p.proof_path ? <button type="button" onClick={() => openProtectedFile(p.proof_path!)} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"><Paperclip className="h-3 w-3" />View</button> : <span className="text-muted-foreground text-[11px]">—</span>}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${isVoided ? 'line-through' : ''}`}>{formatKES(p.amount)}</td>
                        <td className="py-2.5 px-3 text-center">{isVoided ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">Voided</span> : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/20">Valid</span>}</td>
                        <td className="py-2.5 px-3 text-right">{!isVoided && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10" onClick={() => setVoidingPayment(p)}><Ban className="h-3 w-3 mr-1" />Void</Button>}</td>
                      </tr>); })}</tbody></table></div>
                )}
              </div>
              {detailsModalInvoice.credit_notes && detailsModalInvoice.credit_notes.length > 0 && (
                <div className="space-y-2"><span className="font-semibold text-foreground text-sm flex items-center gap-1.5"><FileBadge className="h-4 w-4 text-amber-500" />Credit Notes</span>
                  <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="bg-secondary/60 text-muted-foreground border-b border-border"><tr><th className="py-2 px-3 text-left">CN #</th><th className="py-2 px-3 text-left">Date</th><th className="py-2 px-3 text-left">Reason</th><th className="py-2 px-3 text-right">Amount</th></tr></thead>
                    <tbody className="divide-y divide-border">{detailsModalInvoice.credit_notes.map(cn => (<tr key={cn.id}><td className="py-2.5 px-3 font-mono font-semibold text-primary">{cn.number}</td><td className="py-2.5 px-3">{cn.created_at?.slice(0,10)}</td><td className="py-2.5 px-3 text-muted-foreground">{cn.reason}</td><td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600">- {formatKES(cn.amount)}</td></tr>))}</tbody></table></div>
                </div>
              )}
              <div className="space-y-2 pt-2 border-t border-border"><span className="font-semibold text-foreground text-sm flex items-center gap-1.5"><History className="h-4 w-4 text-primary" />Invoice Audit Trail</span><HistoryTimeline auditableType="invoice" auditableId={detailsModalInvoice.id} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDetailsModalInvoice(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <CreditNoteDialog invoice={creditNoteInvoice} open={!!creditNoteInvoice} onOpenChange={o => !o && setCreditNoteInvoice(null)} />
      <VoidPaymentDialog payment={voidingPayment} open={!!voidingPayment} onOpenChange={o => !o && setVoidingPayment(null)} onSuccess={() => setDetailsModalInvoice(null)} />
    </div>
  );
}