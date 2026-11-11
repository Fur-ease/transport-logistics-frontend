'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  MapPin,
  Plus,
  Search,
  ArrowUpRight,
  Filter,
  DollarSign,
  Truck,
  User,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { Trip, Truck as TruckType, Driver, Customer } from '@/types';

const tripSchema = z.object({
  truck_id: z.number().min(1, 'Please select a truck'),
  driver_id: z.number().min(1, 'Please select a driver'),
  customer_id: z.number().min(1, 'Please select a customer'),
  origin: z.string().min(2, 'Origin city/location required'),
  destination: z.string().min(2, 'Destination city/location required'),
  cargo_description: z.string().min(3, 'Cargo description required'),
  cargo_weight_tons: z.number().min(0.1, 'Valid cargo weight required'),
  agreed_rate: z.number().min(1, 'Agreed revenue rate required in KES'),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional(),
  start_odometer: z.number().min(0, 'Starting odometer required'),
  notes: z.string().optional(),
});

type TripFormData = z.infer<typeof tripSchema>;

export default function TripsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch trips
  const { data, isLoading } = useQuery<{ data: Trip[]; total: number }>({
    queryKey: ['trips', statusFilter, search],
    queryFn: () => api.get<{ data: Trip[]; total: number }>('/trips', { status: statusFilter, search }),
  });

  const trips = data?.data || [];

  // Options for modal dropdowns
  const { data: trucksData } = useQuery<{ data: TruckType[] }>({
    queryKey: ['trucks-list'],
    queryFn: () => api.get<{ data: TruckType[] }>('/trucks'),
  });

  const { data: driversData } = useQuery<{ data: Driver[] }>({
    queryKey: ['drivers-list'],
    queryFn: () => api.get<{ data: Driver[] }>('/drivers'),
  });

  const { data: customersData } = useQuery<{ data: Customer[] }>({
    queryKey: ['customers-list'],
    queryFn: () => api.get<{ data: Customer[] }>('/customers'),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      start_date: new Date().toISOString().split('T')[0],
      agreed_rate: 120000,
      cargo_weight_tons: 25,
      start_odometer: 0,
    },
  });

  // Watch selected truck to prefill starting odometer
  const selectedTruckId = watch('truck_id');
  React.useEffect(() => {
    if (selectedTruckId && trucksData?.data) {
      const selected = trucksData.data.find((t) => t.id === Number(selectedTruckId));
      if (selected && selected.odometer_km) {
        setValue('start_odometer', selected.odometer_km);
      }
    }
  }, [selectedTruckId, trucksData, setValue]);

  const createMutation = useMutation({
    mutationFn: (newTrip: TripFormData) => api.post('/trips', newTrip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast.success('Trip created and dispatched successfully');
      setSheetOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create trip');
    },
  });

  const onSubmit = (formData: TripFormData) => {
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips & Dispatch"
        description="The central record of truth linking truck, driver, customer, agreed revenue, and every trip expense."
        actions={
          <Button onClick={() => setSheetOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Create Trip</span>
          </Button>
        }
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ref (e.g. TRIP-0001), route, plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'planned', 'in_transit', 'delivered', 'invoiced', 'paid', 'cancelled'].map((st) => (
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

      {/* Trips Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No trips found"
          description={search ? 'No trips match your filter criteria.' : 'Create your first haulage trip to begin.'}
          actionLabel="Create Trip"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                <th className="py-3 px-4 text-left font-medium">Route & Dates</th>
                <th className="py-3 px-4 text-left font-medium">Truck & Driver</th>
                <th className="py-3 px-4 text-left font-medium">Customer & Cargo</th>
                <th className="py-3 px-4 text-right font-medium">Revenue (KES)</th>
                <th className="py-3 px-4 text-right font-medium">Direct Costs</th>
                <th className="py-3 px-4 text-right font-semibold text-success">Contribution</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/trips/${trip.id}`} className="hover:underline">
                        {trip.reference}
                      </Link>
                      {(trip.version ?? 1) > 1 && (
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20" title={`Version ${trip.version} (Edited)`}>
                          v{trip.version}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-foreground">{trip.origin} → {trip.destination}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(trip.start_date)} {trip.end_date ? `to ${formatDate(trip.end_date)}` : '• Ongoing'}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-mono text-xs font-bold text-foreground">{trip.truck?.reg_number}</p>
                    <p className="text-xs text-muted-foreground">{trip.driver?.name}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-foreground">{trip.customer?.name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{trip.cargo_description}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <MoneyText amount={trip.agreed_rate} size="base" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <MoneyText amount={trip.approved_expenses_total} variant="negative" size="base" />
                  </td>
                  {/* Trip P&L Contribution = Revenue - Approved Direct Expenses */}
                  <td className="py-3.5 px-4 text-right">
                    <MoneyText amount={trip.contribution} variant="positive" size="base" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusBadge status={trip.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/trips/${trip.id}`}>
                        <span>P&L Details</span>
                        <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Trip Sheet / Drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create New Trip</SheetTitle>
            <SheetDescription>
              Dispatches a truck and driver with agreed customer haulage rate.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Truck Selector */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Assign Truck (Checks Overlapping Active Trips)
              </label>
              <select
                {...register('truck_id', { valueAsNumber: true })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="">-- Select fleet vehicle --</option>
                {trucksData?.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reg_number} — {t.make} {t.model} ({t.status})
                  </option>
                ))}
              </select>
              {errors.truck_id && (
                <p className="text-[11px] text-destructive mt-1">{errors.truck_id.message}</p>
              )}
            </div>

            {/* Driver & Customer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Driver</label>
                <select
                  {...register('driver_id', { valueAsNumber: true })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Driver --</option>
                  {driversData?.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.licence_no})
                    </option>
                  ))}
                </select>
                {errors.driver_id && (
                  <p className="text-[11px] text-destructive mt-1">{errors.driver_id.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Customer</label>
                <select
                  {...register('customer_id', { valueAsNumber: true })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Customer --</option>
                  {customersData?.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.customer_id && (
                  <p className="text-[11px] text-destructive mt-1">{errors.customer_id.message}</p>
                )}
              </div>
            </div>

            {/* Origin & Destination */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Origin City/Depot</label>
                <Input placeholder="e.g. Mombasa Port" {...register('origin')} />
                {errors.origin && (
                  <p className="text-[11px] text-destructive mt-1">{errors.origin.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Destination</label>
                <Input placeholder="e.g. Nairobi ICD" {...register('destination')} />
                {errors.destination && (
                  <p className="text-[11px] text-destructive mt-1">{errors.destination.message}</p>
                )}
              </div>
            </div>

            {/* Cargo description & weight */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">Cargo Description</label>
                <Input placeholder="e.g. 40ft Container, Steel Coils" {...register('cargo_description')} />
                {errors.cargo_description && (
                  <p className="text-[11px] text-destructive mt-1">{errors.cargo_description.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Weight (Tons)</label>
                <Input type="number" step="0.1" {...register('cargo_weight_tons', { valueAsNumber: true })} />
                {errors.cargo_weight_tons && (
                  <p className="text-[11px] text-destructive mt-1">{errors.cargo_weight_tons.message}</p>
                )}
              </div>
            </div>

            {/* Agreed Rate (Revenue) & Start Odometer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Agreed Rate (KES Revenue)
                </label>
                <Input type="number" step="1000" {...register('agreed_rate', { valueAsNumber: true })} />
                {errors.agreed_rate && (
                  <p className="text-[11px] text-destructive mt-1">{errors.agreed_rate.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Start Odometer (KM)
                </label>
                <Input type="number" {...register('start_odometer', { valueAsNumber: true })} />
                {errors.start_odometer && (
                  <p className="text-[11px] text-destructive mt-1">{errors.start_odometer.message}</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Trip Start Date</label>
                <Input type="date" {...register('start_date')} />
                {errors.start_date && (
                  <p className="text-[11px] text-destructive mt-1">{errors.start_date.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Estimated End Date</label>
                <Input type="date" {...register('end_date')} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Notes / Instructions</label>
              <Input placeholder="Driver instructions, route notes..." {...register('notes')} />
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
                {createMutation.isPending ? 'Scheduling...' : 'Dispatch Trip'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

