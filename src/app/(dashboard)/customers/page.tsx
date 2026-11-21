'use client';
import { syncFinancialState } from '@/lib/liveSync';

import React, { useState } from 'react';
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
  payment_terms_days: z.number().min(0).max(180),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [hasBalance, setHasBalance] = useState('');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Customer[]; meta?: any; summary?: any }>({
    queryKey: ['customers', search, hasBalance, page],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), per_page: '15' });
      if (search.trim()) q.set('search', search.trim());
      if (hasBalance) q.set('has_balance', hasBalance);
      return api.get(`/customers?${q.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const customers = data?.data || [];
  const meta = data?.meta;
  const summary = data?.summary;
  const totalReceivables = summary?.total_owed ?? 0;

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
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{summary?.total_customers ?? meta?.total ?? customers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Invoiced (KES)</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {formatKES(summary?.total_invoiced ?? 0)}
          </p>
        </Card>
        <Card className="p-4 border-destructive/30">
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">Total Outstanding Receivables</p>
          <p className="text-2xl font-bold text-destructive mt-1 tabular-nums">
            {formatKES(totalReceivables)}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <select
          value={hasBalance}
          onChange={(e) => { setHasBalance(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
        >
          <option value="">All balances</option>
          <option value="yes">Has balance</option>
          <option value="no">No balance</option>
        </select>
        {(search || hasBalance) && (
          <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setHasBalance(''); setPage(1); }}>Clear</Button>
        )}
      </div>

      {/* Customer Directory with Ageing Buckets Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No customers found"
          description={search || hasBalance ? 'No client matches your filters.' : 'Add your first customer to bill trips.'}
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
                <th className="py-3 px-3 text-right font-medium text-xs">Current</th>
                <th className="py-3 px-3 text-right font-medium text-xs">1–30d</th>
                <th className="py-3 px-3 text-right font-medium text-xs">31–60d</th>
                <th className="py-3 px-3 text-right font-medium text-xs text-destructive">61–90d+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((cust) => (
                <tr key={cust.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-foreground text-sm">{cust.name}</p>
                    <p className="text-xs text-muted-foreground">{cust.phone} {cust.email ? `• ${cust.email}` : ''}</p>
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
          <div className="flex items-center justify-between p-3 border-t border-border text-xs">
            <span className="text-muted-foreground">Page {meta?.current_page ?? page} of {meta?.last_page ?? 1} • {meta?.total ?? customers.length} customers</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={(meta?.current_page ?? page) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button size="sm" variant="outline" disabled={(meta?.current_page ?? page) >= (meta?.last_page ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

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

