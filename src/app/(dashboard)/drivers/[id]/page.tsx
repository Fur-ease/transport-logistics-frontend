'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { FileCheck, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { syncFinancialState } from '@/lib/liveSync';
import { formatDate } from '@/lib/formatters';
import { Driver } from '@/types';

const driverSchema = z.object({
  name: z.string().min(3, 'Driver full name is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  licence_no: z.string().min(5, 'Valid driver licence number required'),
  licence_expiry: z.string().min(1, 'Licence expiry date required'),
  status: z.enum(['active', 'on_trip', 'on_leave', 'inactive']),
});
type DriverFormData = z.infer<typeof driverSchema>;

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const driverId = params.id as string;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Driver }>({
    queryKey: ['driver', driverId],
    queryFn: () => api.get<{ data: Driver }>(`/drivers/${driverId}`),
  });

  const driver = data?.data;
  const editForm = useForm<DriverFormData>({ resolver: zodResolver(driverSchema) });

  const updateMutation = useMutation({
    mutationFn: (payload: DriverFormData) => api.put(`/drivers/${driverId}`, { ...payload, version: driver?.version }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Driver updated');
      setEditOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update driver'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<{ message?: string }>(`/drivers/${driverId}`),
    onSuccess: async (res) => {
      await syncFinancialState(queryClient);
      toast.success(res?.message || 'Driver removed');
      setDeleteOpen(false);
      router.push('/drivers');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove driver'),
  });

  const openEdit = () => {
    if (!driver) return;
    editForm.reset({
      name: driver.name || '',
      phone: driver.phone || '',
      licence_no: driver.licence_no || '',
      licence_expiry: driver.licence_expiry ? String(driver.licence_expiry).slice(0, 10) : '',
      status: driver.status as DriverFormData['status'],
    });
    setEditOpen(true);
  };

  if (isLoading || !driver) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const licenceDays = Math.ceil((new Date(driver.licence_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const licenceExpired = licenceDays <= 0;
  const licenceExpiringSoon = licenceDays > 0 && licenceDays <= 30;

  return (
    <div className="space-y-6">
      <PageHeader
        title={driver.name}
        description={`Licence: ${driver.licence_no} • Phone: ${driver.phone}`}
        backHref="/drivers"
        backLabel="Back to drivers"
        breadcrumbs={[
          { label: 'Drivers Roster', href: '/drivers' },
          { label: driver.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={driver.status} />
            <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
          </div>
        }
      />

      {/* Summary Profile Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Driving Licence (NTSA)</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-base font-bold text-foreground">{driver.licence_no}</span>
            {licenceExpired ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/30">
                <AlertTriangle className="h-3 w-3" />
                <span>Expired {formatDate(driver.licence_expiry)}</span>
              </span>
            ) : licenceExpiringSoon ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-foreground border border-warning/30">
                <AlertTriangle className="h-3 w-3" />
                <span>Expires in {licenceDays}d ({formatDate(driver.licence_expiry)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success-foreground border border-success/30">
                <FileCheck className="h-3 w-3" />
                <span>Valid to {formatDate(driver.licence_expiry)}</span>
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Trips Logged</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {driver.trips?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Assigned dispatches</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Advances Accounted</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
            {driver.advances?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Recorded cash settlements</p>
        </Card>
      </div>

      {/* Tabs: Trips, Advances & History */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-10">
          <TabsTrigger value="trips">Trips Made ({driver.trips?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="advances">Advances ({driver.advances?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Trips Made Tab */}
        <TabsContent value="trips" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Completed & Active Trips for {driver.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-left font-medium">Route</th>
                      <th className="py-3 px-4 text-left font-medium">Truck</th>
                      <th className="py-3 px-4 text-left font-medium">Customer</th>
                      <th className="py-3 px-4 text-right font-medium">Rate (Revenue)</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driver.trips?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No trips assigned yet.
                        </td>
                      </tr>
                    ) : (
                      driver.trips?.map((trip) => (
                        <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-primary">
                            <Link href={`/trips/${trip.id}`} className="hover:underline">
                              {trip.reference}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-foreground">{trip.origin} → {trip.destination}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(trip.start_date)}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                            {trip.truck?.reg_number}
                          </td>
                          <td className="py-3 px-4 text-foreground">{trip.customer?.name}</td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={trip.agreed_rate} size="base" />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={trip.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advances History Tab */}
        <TabsContent value="advances" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Advance Settlement Trail</CardTitle>
              <CardDescription>
                Audit history of allowances, accepted receipts, and cash returned
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-right font-medium">1. Advance Given</th>
                      <th className="py-3 px-4 text-right font-medium">2. Expenses Accepted</th>
                      <th className="py-3 px-4 text-right font-medium">3. Amount Returned</th>
                      <th className="py-3 px-4 text-right font-medium">Balance Due</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driver.advances?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No cash advances recorded for this driver.
                        </td>
                      </tr>
                    ) : (
                      driver.advances?.map((adv) => (
                        <tr key={adv.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-bold text-primary">
                            {adv.trip_reference || 'Trip'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.amount_given} size="base" />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.expenses_accepted} variant="positive" size="base" />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.amount_returned} size="base" />
                          </td>
                          <td className="py-3 px-4 text-right font-bold">
                            <MoneyText
                              amount={adv.balance_remaining}
                              variant={adv.balance_remaining > 0 ? 'negative' : 'positive'}
                              size="base"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={adv.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: History & Audit Timeline */}
        <TabsContent value="history" className="mt-4">
          <Card className="p-4">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-base">Driver Profile & Licence Audit Trail</CardTitle>
              <CardDescription>
                Changes to phone, status, and compliance licence details.
              </CardDescription>
            </CardHeader>
            <HistoryTimeline auditableType="driver" auditableId={driver.id} />
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Driver</SheetTitle>
            <SheetDescription>Update driver profile, licence, and status.</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4 py-4">
            <div><label className="text-xs font-semibold block mb-1">Full Name</label><Input {...editForm.register('name')} />{editForm.formState.errors.name && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.name.message}</p>}</div>
            <div><label className="text-xs font-semibold block mb-1">Phone</label><Input {...editForm.register('phone')} />{editForm.formState.errors.phone && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.phone.message}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold block mb-1">Licence #</label><Input {...editForm.register('licence_no')} className="font-mono uppercase" />{editForm.formState.errors.licence_no && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.licence_no.message}</p>}</div>
              <div><label className="text-xs font-semibold block mb-1">Licence Expiry</label><Input type="date" {...editForm.register('licence_expiry')} />{editForm.formState.errors.licence_expiry && <p className="text-[11px] text-destructive mt-1">{editForm.formState.errors.licence_expiry.message}</p>}</div>
            </div>
            <div><label className="text-xs font-semibold block mb-1">Status</label>
              <select {...editForm.register('status')} className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm">
                <option value="active">Active</option><option value="on_trip">On Trip</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <SheetFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Driver</DialogTitle>
            <DialogDescription>Remove {driver.name}? Drivers with trip history will be deactivated instead of permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Removing...' : 'Remove Driver'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

