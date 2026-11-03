'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Camera,
  Plus,
  Receipt,
  Truck,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Fuel,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { FileUpload } from '@/components/shared/FileUpload';
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
import { formatKES, formatKm, formatDate } from '@/lib/formatters';
import { Trip, DriverAdvance, TripExpense } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';

const driverExpenseSchema = z.object({
  trip_id: z.number().min(1, 'Please select an active trip'),
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
  amount: z.number().min(1, 'Enter expense amount in KES'),
  litres: z.number().optional(),
  odometer_at_fill: z.number().optional(),
  notes: z.string().optional(),
});

type DriverExpenseFormData = z.infer<typeof driverExpenseSchema>;

export default function DriverMobileViewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<File | null>(null);

  // Fetch driver's trips
  const { data: tripsData, isLoading } = useQuery<{ data: Trip[] }>({
    queryKey: ['my-driver-trips'],
    queryFn: () => api.get<{ data: Trip[] }>('/trips'),
  });

  // Fetch advances
  const { data: advancesData } = useQuery<{ data: DriverAdvance[] }>({
    queryKey: ['my-advances'],
    queryFn: () => api.get<{ data: DriverAdvance[] }>('/advances'),
  });

  const trips = tripsData?.data || [];
  const advances = advancesData?.data || [];

  const activeTrip = trips.find((t) => t.status === 'in_transit' || t.status === 'planned');
  const activeAdvance = advances.find((a) => a.status === 'open');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DriverExpenseFormData>({
    resolver: zodResolver(driverExpenseSchema),
    defaultValues: {
      category: 'fuel',
      trip_id: activeTrip?.id || (trips[0]?.id ?? 0),
    },
  });

  const watchCat = watch('category');

  // Submit expense mutation
  const expenseMutation = useMutation({
    mutationFn: async (formData: DriverExpenseFormData) => {
      const data = new FormData();
      data.append('category', formData.category);
      data.append('amount', String(formData.amount));
      if (formData.litres) data.append('litres', String(formData.litres));
      if (formData.odometer_at_fill) data.append('odometer_at_fill', String(formData.odometer_at_fill));
      data.append('incurred_at', new Date().toISOString());
      if (formData.notes) data.append('notes', formData.notes);
      if (selectedReceipt) data.append('receipt', selectedReceipt);

      return api.upload(`/trips/${formData.trip_id}/expenses`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['my-advances'] });
      toast.success('Expense receipt submitted to dispatch manager');
      setSheetOpen(false);
      reset();
      setSelectedReceipt(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit expense');
    },
  });

  return (
    <div className="space-y-5 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Driver Dashboard</h1>
          <p className="text-xs text-muted-foreground">Signed in as {user?.name || 'Driver'}</p>
        </div>
        <StatusBadge status={activeTrip ? 'on_trip' : 'active'} />
      </div>

      {/* Driver Advance Balance Card */}
      <Card className="border-accent/40 bg-card overflow-hidden shadow-card">
        <div className="bg-accent/15 px-4 py-2 border-b border-accent/20 flex items-center justify-between">
          <span className="text-xs font-bold text-accent-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <DollarSign className="h-3.5 w-3.5" />
            <span>Driver Trip Advance</span>
          </span>
          <span className="text-[11px] font-semibold text-accent-foreground capitalize">
            {activeAdvance ? 'Open Settlement' : 'No Open Advance'}
          </span>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-secondary">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Cash Given</span>
              <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                {formatKES(activeAdvance?.amount_given ?? 0)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-secondary">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Expenses Accepted</span>
              <p className="text-sm font-bold font-mono text-success mt-0.5">
                {formatKES(activeAdvance?.expenses_accepted ?? 0)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-secondary">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Remaining Due</span>
              <p className="text-sm font-bold font-mono text-primary mt-0.5">
                {formatKES(activeAdvance?.balance_remaining ?? 0)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Upload fuel, toll & cess receipts below to deduct them from your advance.
          </p>
        </CardContent>
      </Card>

      {/* Active Trip Highlight Card */}
      {activeTrip ? (
        <Card className="border-primary/40 bg-card shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-primary">{activeTrip.reference}</span>
              <StatusBadge status={activeTrip.status} />
            </div>
            <CardTitle className="text-base mt-1">
              {activeTrip.origin} → {activeTrip.destination}
            </CardTitle>
            <CardDescription className="text-xs">
              Truck: <span className="font-mono font-bold text-foreground">{activeTrip.truck?.reg_number}</span> • Cargo: {activeTrip.cargo_description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Starting Odometer</span>
              <span className="font-mono font-semibold text-foreground">{formatKm(activeTrip.start_odometer)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Start Date</span>
              <span className="text-foreground">{formatDate(activeTrip.start_date)}</span>
            </div>

            <Button
              className="w-full min-h-[48px] text-sm font-bold cursor-pointer"
              onClick={() => {
                setValue('trip_id', activeTrip.id);
                setSheetOpen(true);
              }}
            >
              <Camera className="mr-2 h-5 w-5 text-accent" />
              <span>Capture & Add Expense</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          No trip currently in transit. Contact your fleet manager for dispatch.
        </Card>
      )}

      {/* Trip History for Driver */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Recent Trips History</h3>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          trips.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-mono font-bold text-primary">{t.reference}</p>
                <p className="font-medium text-foreground text-xs mt-0.5">{t.origin} → {t.destination}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(t.start_date)}</p>
              </div>
              <div className="text-right space-y-1">
                <StatusBadge status={t.status} />
                <p className="font-mono text-[11px] text-muted-foreground">{formatKm(t.total_distance_km)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Glassmorphism Area for Driver */}
      <div className="fixed bottom-20 left-4 right-4 z-30 max-w-md mx-auto">
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full min-h-[52px] rounded-xl glass-surface border border-primary/40 bg-primary/95 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
        >
          <Camera className="h-5 w-5 text-accent" />
          <span>Upload Receipt / Fuel Fill</span>
        </button>
      </div>

      {/* Add Expense Sheet (Mobile Touch-Optimized) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Submit Trip Expense Receipt</SheetTitle>
            <SheetDescription>
              Take a clear picture of the paper receipt or fuel pump meter.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit((d) => expenseMutation.mutate(d))} className="space-y-4 py-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Select Trip</label>
              <select
                {...register('trip_id', { valueAsNumber: true })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reference} — {t.origin} to {t.destination} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Expense Type</label>
              <select
                {...register('category')}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary capitalize"
              >
                <option value="fuel">Fuel (Diesel Refill)</option>
                <option value="allowance">Allowance / Food / Lodging</option>
                <option value="toll">Toll / Weighbridge Fee</option>
                <option value="county_levy_cess">County Cess / Local Council</option>
                <option value="loading_offloading">Loading / Porter Fee</option>
                <option value="repairs">Emergency Tyre / Mechanic Fix</option>
                <option value="other">Other Incidentals</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Amount Spent (KES)</label>
              <Input
                type="number"
                step="10"
                placeholder="e.g. 8500"
                className="h-12 text-base font-bold font-mono"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-[11px] text-destructive mt-1">{errors.amount.message}</p>
              )}
            </div>

            {watchCat === 'fuel' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-secondary border border-border">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Litres</label>
                  <Input type="number" step="0.1" placeholder="e.g. 120" className="h-11" {...register('litres', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Current Odometer</label>
                  <Input type="number" placeholder="KM" className="h-11 font-mono" {...register('odometer_at_fill', { valueAsNumber: true })} />
                </div>
              </div>
            )}

            {/* Receipt Camera Capture (allows direct camera use) */}
            <FileUpload
              onFileSelect={(file) => setSelectedReceipt(file)}
              allowCamera={true}
              label="Photograph Receipt (Camera Auto-Focus)"
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Vendor / Description</label>
              <Input placeholder="e.g. Shell Mariakani, Oloitokitok toll..." className="h-11" {...register('notes')} />
            </div>

            <SheetFooter className="mt-4 pb-6">
              <Button
                type="submit"
                className="w-full min-h-[50px] text-base font-bold"
                disabled={expenseMutation.isPending}
              >
                {expenseMutation.isPending ? 'Sending Receipt...' : 'Confirm & Submit Expense'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

