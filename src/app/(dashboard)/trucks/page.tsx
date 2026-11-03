'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Truck as TruckIcon,
  Plus,
  LayoutGrid,
  List,
  Search,
  ArrowUpRight,
  Gauge,
  Weight,
  Calendar,
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
import { formatNumber, formatKm } from '@/lib/formatters';
import { Truck } from '@/types';

const truckSchema = z.object({
  reg_number: z.string().min(4, 'Enter a valid Kenya plate number (e.g. KDA 482B)'),
  make: z.string().min(2, 'Make is required (e.g. Scania)'),
  model: z.string().min(2, 'Model is required (e.g. R500)'),
  year: z.number().min(1990).max(new Date().getFullYear() + 1),
  type: z.string().min(2, 'Truck type is required'),
  capacity_tons: z.number().min(0.5, 'Enter valid capacity in tons'),
  odometer_km: z.number().min(0, 'Enter valid odometer reading'),
  status: z.enum(['available', 'on_trip', 'maintenance', 'inactive']),
});

type TruckFormData = z.infer<typeof truckSchema>;

export default function TrucksPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Truck[] }>({
    queryKey: ['trucks', statusFilter, search],
    queryFn: () => api.get<{ data: Truck[] }>('/trucks', { status: statusFilter, search }),
  });

  const trucks = data?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TruckFormData>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      status: 'available',
      type: 'Prime Mover',
      year: new Date().getFullYear(),
      capacity_tons: 28,
      odometer_km: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (newTruck: TruckFormData) => api.post('/trucks', newTruck),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Truck registered into fleet successfully');
      setSheetOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register truck');
    },
  });

  const onSubmit = (formData: TruckFormData) => {
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Trucks"
        description="Manage vehicles, odometer logs, maintenance status, and track completed trips per truck."
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-border bg-card p-1 shadow-sm">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'cards' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <Button onClick={() => setSheetOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              <span>Add Truck</span>
            </Button>
          </div>
        }
      />

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plate (e.g. KDA 482B), make, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'available', 'on_trip', 'maintenance', 'inactive'].map((st) => (
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

      {/* Content Rendering: Table or Cards */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : trucks.length === 0 ? (
        <EmptyState
          icon={<TruckIcon className="h-8 w-8" />}
          title="No trucks found"
          description={search ? 'No vehicles match your search query.' : 'Get started by adding your first truck.'}
          actionLabel="Add Truck"
          onAction={() => setSheetOpen(true)}
        />
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Plate Number</th>
                <th className="py-3 px-4 text-left font-medium">Vehicle Specs</th>
                <th className="py-3 px-4 text-left font-medium">Type & Capacity</th>
                <th className="py-3 px-4 text-right font-medium">Odometer</th>
                <th className="py-3 px-4 text-center font-semibold text-primary">Trips Made</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trucks.map((truck) => (
                <tr key={truck.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/trucks/${truck.id}`}
                      className="font-mono font-bold text-sm text-primary hover:underline"
                    >
                      {truck.reg_number}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-foreground">{truck.make} {truck.model}</p>
                    <p className="text-xs text-muted-foreground">{truck.year}</p>
                  </td>
                  <td className="py-3.5 px-4 text-foreground">
                    <p className="font-medium text-xs">{truck.type}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{truck.capacity_tons} tons</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                    {formatKm(truck.odometer_km)}
                  </td>
                  {/* Must-have prominent Trips Made column */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                      {truck.completed_trips ?? 0} completed
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusBadge status={truck.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/trucks/${truck.id}`}>
                        <span>Details</span>
                        <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trucks.map((truck) => (
            <Card key={truck.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/trucks/${truck.id}`}
                      className="font-mono font-bold text-base text-primary hover:underline"
                    >
                      {truck.reg_number}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{truck.make} {truck.model} ({truck.year})</p>
                  </div>
                  <StatusBadge status={truck.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Capacity</span>
                    <span className="font-semibold text-foreground">{truck.capacity_tons} Tons</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Odometer</span>
                    <span className="font-mono font-medium text-foreground">{formatKm(truck.odometer_km)}</span>
                  </div>
                </div>

                {/* Prominent Trips Made indicator */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/70 border border-border">
                  <span className="text-xs font-medium text-muted-foreground">Trips Completed</span>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {truck.completed_trips ?? 0} trips
                  </span>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/trucks/${truck.id}`}>
                    <span>View Performance & Trips</span>
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Truck Drawer / Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Register New Truck</SheetTitle>
            <SheetDescription>
              Add a commercial vehicle to Simba Hauliers fleet roster.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Registration Plate (e.g. KDA 482B)
              </label>
              <Input
                placeholder="KDA 482B"
                {...register('reg_number')}
                className="font-mono uppercase"
              />
              {errors.reg_number && (
                <p className="text-[11px] text-destructive mt-1">{errors.reg_number.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Make</label>
                <Input placeholder="Scania / Isuzu / Actros" {...register('make')} />
                {errors.make && (
                  <p className="text-[11px] text-destructive mt-1">{errors.make.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Model</label>
                <Input placeholder="R500 / Giga / 2645" {...register('model')} />
                {errors.model && (
                  <p className="text-[11px] text-destructive mt-1">{errors.model.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Year of Manufacture</label>
                <Input type="number" {...register('year', { valueAsNumber: true })} />
                {errors.year && (
                  <p className="text-[11px] text-destructive mt-1">{errors.year.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Type</label>
                <select
                  {...register('type')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Prime Mover">Prime Mover</option>
                  <option value="Flatbed">Flatbed</option>
                  <option value="Box Truck">Box Truck</option>
                  <option value="Tipper">Tipper</option>
                  <option value="Tanker">Tanker</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Capacity (Tons)</label>
                <Input type="number" step="0.1" {...register('capacity_tons', { valueAsNumber: true })} />
                {errors.capacity_tons && (
                  <p className="text-[11px] text-destructive mt-1">{errors.capacity_tons.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Current Odometer (KM)</label>
                <Input type="number" {...register('odometer_km', { valueAsNumber: true })} />
                {errors.odometer_km && (
                  <p className="text-[11px] text-destructive mt-1">{errors.odometer_km.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Initial Status</label>
              <select
                {...register('status')}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="available">Available</option>
                <option value="on_trip">On Trip</option>
                <option value="maintenance">Maintenance</option>
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
                {createMutation.isPending ? 'Saving...' : 'Register Vehicle'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

