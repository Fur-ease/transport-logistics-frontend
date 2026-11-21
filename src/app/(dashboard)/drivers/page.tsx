'use client';
import { syncFinancialState } from '@/lib/liveSync';

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
  Pencil,
  Trash2,
  Eye,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
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
  const [licenseFilter, setLicenseFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const { data, isLoading } = useQuery<{ data: Driver[]; meta?: any; current_page?: number; last_page?: number; total?: number }>({
    queryKey: ['drivers', statusFilter, licenseFilter, search, page],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page), per_page: '15' });
      if (statusFilter !== 'all') q.set('status', statusFilter);
      if (licenseFilter !== 'all') q.set('license_alert', licenseFilter);
      if (search.trim()) q.set('search', search.trim());
      return api.get(`/drivers?${q.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const drivers = data?.data || [];
  const meta = data?.meta ?? data;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: { status: 'active' },
  });

  const editForm = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
  });

  const createMutation = useMutation({
    mutationFn: (newDriver: DriverFormData) => api.post('/drivers', newDriver),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Driver registered successfully');
      setSheetOpen(false);
      reset({ name: '', phone: '', licence_no: '', licence_expiry: '', status: 'active' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register driver');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DriverFormData }) =>
      api.put(`/drivers/${id}`, { ...payload, version: editingDriver?.version }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Driver updated successfully');
      setEditOpen(false);
      setEditingDriver(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update driver');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ message?: string; action_taken?: string }>(`/drivers/${id}`),
    onSuccess: async (res) => {
      await syncFinancialState(queryClient);
      toast.success(res?.message || 'Driver removed');
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove driver');
    },
  });

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver);
    editForm.reset({
      name: driver.name || '',
      phone: driver.phone || '',
      licence_no: driver.licence_no || '',
      licence_expiry: driver.licence_expiry ? String(driver.licence_expiry).slice(0, 10) : '',
      status: driver.status as DriverFormData['status'],
    });
    setEditOpen(true);
  };

  const getLicenceAlert = (expiryStr: string) => {
    const days = Math.ceil((new Date(expiryStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: 'Expired', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
    if (days <= 30) return { label: `Renew Soon (${days}d)`, cls: 'bg-warning-bg text-warning-foreground border-warning/30' };
    return null;
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, licence..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <select value={licenseFilter} onChange={(e) => { setLicenseFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground">
            <option value="all">All license statuses</option>
            <option value="expired">Expired</option>
            <option value="expiring_soon">Expiring within 30 days</option>
            <option value="valid">Valid (&gt;30 days)</option>
          </select>
          {(search || statusFilter !== 'all' || licenseFilter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setStatusFilter('all'); setLicenseFilter('all'); setPage(1); }}>Clear</Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'active', 'on_trip', 'on_leave', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setPage(1); }}
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
                const licenceAlert = getLicenceAlert(driver.licence_expiry);

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
                        {licenceAlert && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${licenceAlert.cls}`}>
                            <AlertTriangle className="h-3 w-3" />
                            <span>{licenceAlert.label}</span>
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
                      <div className="inline-flex items-center gap-1">
                        <Button asChild variant="ghost" size="sm" title="View profile">
                          <Link href={`/drivers/${driver.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(driver)} title="Edit driver">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(driver)} title="Delete/deactivate driver" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 border-t border-border text-xs">
            <span className="text-muted-foreground">Page {meta?.current_page ?? page} of {meta?.last_page ?? 1} • {meta?.total ?? drivers.length} drivers</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={(meta?.current_page ?? page) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button size="sm" variant="outline" disabled={(meta?.current_page ?? page) >= (meta?.last_page ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Register Driver</SheetTitle>
            <SheetDescription>Add a commercial vehicle driver to the organization.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
              <Input placeholder="e.g. Peter Ochieng" {...register('name')} />
              {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
              <Input placeholder="+2547..." {...register('phone')} />
              {errors.phone && <p className="text-[11px] text-destructive mt-1">{errors.phone.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Driving Licence #</label>
                <Input placeholder="DL-884219A" {...register('licence_no')} className="font-mono uppercase" />
                {errors.licence_no && <p className="text-[11px] text-destructive mt-1">{errors.licence_no.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Licence Expiry</label>
                <Input type="date" {...register('licence_expiry')} />
                {errors.licence_expiry && <p className="text-[11px] text-destructive mt-1">{errors.licence_expiry.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Status</label>
              <select {...register('status')} className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="active">Active</option>
                <option value="on_trip">On Trip</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <SheetFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Register Driver'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Driver Sheet */}
      <Sheet open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingDriver(null); }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Driver</SheetTitle>
            <SheetDescription>Update driver profile, licence, and status.</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit((d) => editingDriver && updateMutation.mutate({ id: editingDriver.id, payload: d }))} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
              <Input {...editForm.register('phone')} />
              {editForm.formState.errors.phone && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.phone.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Driving Licence #</label>
                <Input {...editForm.register('licence_no')} className="font-mono uppercase" />
                {editForm.formState.errors.licence_no && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.licence_no.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Licence Expiry</label>
                <Input type="date" {...editForm.register('licence_expiry')} />
                {editForm.formState.errors.licence_expiry && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.licence_expiry.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Status</label>
              <select {...editForm.register('status')} className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="active">Active</option>
                <option value="on_trip">On Trip</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <SheetFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete/Deactivate Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Driver</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Remove ${deleteTarget.name}? Drivers with trip history will be deactivated instead of permanently deleted.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Removing...' : 'Remove Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

