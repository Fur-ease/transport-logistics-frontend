'use client';
import { syncFinancialState } from '@/lib/liveSync';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Plus,
  Search,
  DollarSign,
  Clock,
  Phone,
  Mail,
  AlertCircle,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES } from '@/lib/formatters';
import { Customer } from '@/types';

const customerSchema = z.object({
  name: z.string().min(2, 'Customer / Corporate name is required'),
  phone: z.string().min(10, 'Valid phone contact is required'),
  email: z.string().email('Valid email address required').optional().or(z.literal('')),
  physical_address: z.string().max(255, 'Physical address is too long').optional().or(z.literal('')),
  po_box: z.string().max(100, 'P.O. Box is too long').optional().or(z.literal('')),
  payment_terms_days: z.number().min(0).max(180),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'OWING' | 'SETTLED' | 'OVERDUE_60'>('ALL');
  const [termsFilter, setTermsFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Customer[] }>({
    queryKey: ['customers'],
    queryFn: () => api.get<{ data: Customer[] }>('/customers'),
  });

  const customers = useMemo(() => data?.data || [], [data]);

  const filteredCustomers = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const q = search.trim().toLowerCase();

    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false);

      const owed = c.balance_owed || 0;
      const overdue60 = (c.aging?.days_61_90 || 0) + (c.aging?.days_90_plus || 0);
      const matchesBalance =
        balanceFilter === 'ALL' ||
        (balanceFilter === 'OWING' && owed > 0) ||
        (balanceFilter === 'SETTLED' && owed <= 0) ||
        (balanceFilter === 'OVERDUE_60' && overdue60 > 0);

      const terms = c.payment_terms_days ?? 0;
      const matchesTerms =
        termsFilter === 'ALL' ||
        (termsFilter === '0' && terms === 0) ||
        (termsFilter === '15' && terms > 0 && terms <= 15) ||
        (termsFilter === '30' && terms > 15 && terms <= 30) ||
        (termsFilter === '60' && terms > 30);

      let matchesDate = true;
      if (fromMs !== null || toMs !== null) {
        if (!c.created_at) {
          matchesDate = false;
        } else {
          const createdMs = new Date(c.created_at).getTime();
          if (fromMs !== null && createdMs < fromMs) matchesDate = false;
          if (toMs !== null && createdMs > toMs) matchesDate = false;
        }
      }

      return matchesSearch && matchesBalance && matchesTerms && matchesDate;
    });
  }, [customers, search, balanceFilter, termsFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, balanceFilter, termsFilter, dateFrom, dateTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedCustomers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, safePage, pageSize]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    balanceFilter !== 'ALL' ||
    termsFilter !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setSearch('');
    setBalanceFilter('ALL');
    setTermsFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const applyDatePreset = (preset: 'all' | 'today' | 'last7' | 'last30') => {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (preset === 'today') {
      const s = fmt(today);
      setDateFrom(s);
      setDateTo(s);
      return;
    }
    const from = new Date(today);
    from.setDate(today.getDate() - (preset === 'last7' ? 7 : 30));
    setDateFrom(fmt(from));
    setDateTo(fmt(today));
  };

  const totalReceivables = customers.reduce((sum, c) => sum + (c.balance_owed || 0), 0);
  const filteredInvoiced = filteredCustomers.reduce((sum, c) => sum + (c.total_invoiced || 0), 0);
  const filteredReceivables = filteredCustomers.reduce((sum, c) => sum + (c.balance_owed || 0), 0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  const createMutation = useMutation({
    mutationFn: (newCust: CustomerFormData) => api.post('/customers', newCust),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Customer registered successfully');
      setSheetOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register customer');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers & Receivables"
        description="Accounts directory, credit payment terms, outstanding invoices, and receivable ageing buckets."
        actions={
          <Button onClick={() => setSheetOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Add Customer</span>
          </Button>
        }
      />

      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Corporate Clients</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{customers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Invoiced (KES)</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {formatKES(customers.reduce((sum, c) => sum + (c.total_invoiced || 0), 0))}
          </p>
        </Card>
        <Card className="p-4 border-destructive/30">
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">Total Outstanding Receivables</p>
          <p className="text-2xl font-bold text-destructive mt-1 tabular-nums">
            {formatKES(totalReceivables)}
          </p>
        </Card>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={`gap-1.5 ${showFilters ? 'border-primary text-primary' : ''}`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Balance Status
                </label>
                <select
                  value={balanceFilter}
                  onChange={(e) =>
                    setBalanceFilter(
                      e.target.value as 'ALL' | 'OWING' | 'SETTLED' | 'OVERDUE_60'
                    )
                  }
                  className="w-full h-9 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Balances</option>
                  <option value="OWING">Outstanding Balance (&gt; 0)</option>
                  <option value="SETTLED">Settled (0 Balance)</option>
                  <option value="OVERDUE_60">Overdue 61+ Days</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Payment Terms
                </label>
                <select
                  value={termsFilter}
                  onChange={(e) => setTermsFilter(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Terms</option>
                  <option value="0">Cash / COD (0 days)</option>
                  <option value="15">1–15 Days</option>
                  <option value="30">16–30 Days</option>
                  <option value="60">31+ Days</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Created From
                </label>
                <div className="relative">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-card pl-8 pr-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Created To
                </label>
                <div className="relative">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-card pl-8 pr-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Quick dates:
              </span>
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'last7', label: 'Last 7 Days' },
                { key: 'last30', label: 'Last 30 Days' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() =>
                    applyDatePreset(preset.key as 'all' | 'today' | 'last7' | 'last30')
                  }
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary hover:bg-primary/10 hover:text-primary text-foreground transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Customer Directory with Ageing Buckets Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No customers found"
          description={search ? 'No client matches your search.' : 'Add your first customer to bill trips.'}
          actionLabel="Add Customer"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Customer</th>
                <th className="py-3 px-4 text-left font-medium">Terms</th>
                <th className="py-3 px-4 text-right font-medium">Total Billed</th>
                <th className="py-3 px-4 text-right font-semibold text-destructive">Balance Owed</th>
                {/* Ageing Buckets as requested by prompt */}
                <th className="py-3 px-3 text-right font-medium text-xs">Current</th>
                <th className="py-3 px-3 text-right font-medium text-xs">1–30d</th>
                <th className="py-3 px-3 text-right font-medium text-xs">31–60d</th>
                <th className="py-3 px-3 text-right font-medium text-xs text-destructive">61–90d+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-foreground text-sm">{cust.name}</p>
                    <p className="text-xs text-muted-foreground">{cust.phone} {cust.email ? `• ${cust.email}` : ''}</p>
                    {(cust.physical_address || cust.po_box) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[cust.physical_address, cust.po_box ? `P.O. Box ${cust.po_box.replace(/^P\.?O\.?\s*Box\s*/i, '')}` : null]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary border border-border font-medium">
                      {cust.payment_terms_days} days
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                    {formatKES(cust.total_invoiced)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                    <MoneyText
                      amount={cust.balance_owed}
                      variant={cust.balance_owed && cust.balance_owed > 0 ? 'negative' : 'muted'}
                      size="base"
                    />
                  </td>
                  {/* Ageing bucket columns */}
                  <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {cust.aging?.current ? formatKES(cust.aging.current) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {cust.aging?.days_1_30 ? formatKES(cust.aging.days_1_30) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-warning font-medium">
                    {cust.aging?.days_31_60 ? formatKES(cust.aging.days_31_60) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-destructive font-semibold">
                    {cust.aging?.days_61_90 || cust.aging?.days_90_plus
                      ? formatKES((cust.aging?.days_61_90 || 0) + (cust.aging?.days_90_plus || 0))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && filteredCustomers.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-foreground">{(safePage - 1) * pageSize + 1}</strong>–
              <strong className="text-foreground">
                {Math.min(safePage * pageSize, filteredCustomers.length)}
              </strong>{' '}
              of <strong className="text-foreground">{filteredCustomers.length}</strong>{' '}
              {filteredCustomers.length === 1 ? 'customer' : 'customers'}
            </span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed font-medium text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1.5">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors ${
                      item === safePage
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card hover:bg-secondary text-foreground'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed font-medium text-foreground"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Customers Footer */}
      <footer className="rounded-xl border border-border bg-card/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">HaulTrack Customers &amp; Receivables</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} HaulTrack</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span>
            Filtered: <strong className="text-foreground">{filteredCustomers.length}</strong> /{' '}
            {customers.length}
          </span>
          <span>•</span>
          <span>
            Invoiced: <strong className="text-foreground">{formatKES(filteredInvoiced)}</strong>
          </span>
          <span>•</span>
          <span>
            Receivables:{' '}
            <strong className="text-destructive">{formatKES(filteredReceivables)}</strong>
          </span>
        </div>
      </footer>

      {/* Add Customer Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Customer Account</SheetTitle>
            <SheetDescription>
              Register a corporate shipper, manufacturer, or cargo consignor.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Company / Client Name</label>
              <Input placeholder="e.g. Bidco Africa Ltd" {...register('name')} />
              {errors.name && (
                <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
              <Input placeholder="+2547..." {...register('phone')} />
              {errors.phone && (
                <p className="text-[11px] text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
              <Input type="email" placeholder="billing@client.com" {...register('email')} />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Physical Address</label>
              <Input placeholder="e.g. Mombasa Road, Nairobi" {...register('physical_address')} />
              {errors.physical_address && (
                <p className="text-[11px] text-destructive mt-1">{errors.physical_address.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">P.O. Box</label>
              <Input placeholder="e.g. P.O. Box 45678-00100" {...register('po_box')} />
              {errors.po_box && (
                <p className="text-[11px] text-destructive mt-1">{errors.po_box.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Payment Credit Terms (Days)</label>
              <Input type="number" {...register('payment_terms_days', { valueAsNumber: true })} />
              <p className="text-[11px] text-muted-foreground mt-1">Default is 30 days credit.</p>
            </div>

            <SheetFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Customer'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

