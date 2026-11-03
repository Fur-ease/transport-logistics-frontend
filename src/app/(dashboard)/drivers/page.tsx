'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Users,
  Plus,
  Search,
  ArrowUpRight,
  Phone,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
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
import { formatDate } from '@/lib/formatters';
import { Driver } from '@/types';

const driverSchema = z.object({
  name: z.string().min(3, 'Driver full name is required'),
  phone: z.string().min(10, 'Valid phone number required (e.g. +2547...)'),
  licence_no: z.string().min(5, 'Valid driver licence number required'),
  licence_expiry: z.string().min(1, 'Licence expiry date required'),
  status: z.enum(['active', 'on_trip', 'on_leave', 'inactive']),
});

type DriverFormData = z.infer<typeof driverSchema>;

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Driver[] }>({
    queryKey: ['drivers', statusFilter, search],
    queryFn: () => api.get<{ data: Driver[] }>('/drivers', { status: statusFilter, search }),
  });

  const drivers = data?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      status: 'active',
      licence_expiry: new Date(new Date().setFullYear(new Date().getFullYear() + 2))
        .toISOString()
        .split('T')[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: (newDriver: DriverFormData) => api.post('/drivers', newDriver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver registered successfully');
      setSheetOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register driver');
    },
  });

  const isLicenceExpiringSoon = (expiryStr: string) => {
    const diffDays = Math.ceil(
      (new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays <= 30;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers Roster"
        description="Driver assignments, valid commercial driving licences (NTSA), trip history and advance settlement."
        actions={
          <Button onClick={() => setSheetOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Add Driver</span>
          </Button>
        }
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search driver name, phone, licence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'active', 'on_trip', 'on_leave', 'inactive'].map((st) => (
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

      {/* Table view */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No drivers found"
          description={search ? 'No driver matches your search query.' : 'Add your first driver to the team.'}
          actionLabel="Add Driver"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Driver Name</th>
                <th className="py-3 px-4 text-left font-medium">Phone & Contact</th>
                <th className="py-3 px-4 text-left font-medium">Licence No</th>
                <th className="py-3 px-4 text-left font-medium">Licence Expiry</th>
                <th className="py-3 px-4 text-center font-semibold text-primary">Trips Made</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {drivers.map((driver) => {
                const expiringSoon = isLicenceExpiringSoon(driver.licence_expiry);

                return (
                  <tr key={driver.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/drivers/${driver.id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary hover:underline"
                      >
                        {driver.name}
                      </Link>
                      {driver.user && (
                        <p className="text-[11px] text-muted-foreground">Mobile App User</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-foreground">
                      {driver.phone}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-foreground">
                      {driver.licence_no}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground tabular-nums">
                          {formatDate(driver.licence_expiry)}
                        </span>
                        {expiringSoon && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-foreground border border-warning/30">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Renew Soon</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                        {driver.completed_trips ?? 0} completed
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={driver.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/drivers/${driver.id}`}>
                          <span>Profile</span>
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Driver Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Register Driver</SheetTitle>
            <SheetDescription>
              Add a commercial vehicle driver to the organization.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
              <Input placeholder="e.g. Peter Ochieng" {...register('name')} />
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Driving Licence #</label>
                <Input placeholder="DL-884219A" {...register('licence_no')} className="font-mono uppercase" />
                {errors.licence_no && (
                  <p className="text-[11px] text-destructive mt-1">{errors.licence_no.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Licence Expiry</label>
                <Input type="date" {...register('licence_expiry')} />
                {errors.licence_expiry && (
                  <p className="text-[11px] text-destructive mt-1">{errors.licence_expiry.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Status</label>
              <select
                {...register('status')}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="on_trip">On Trip</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
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
                {createMutation.isPending ? 'Saving...' : 'Register Driver'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

