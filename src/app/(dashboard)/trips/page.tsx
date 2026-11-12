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
  Truck as TruckIcon,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditTripSheet } from '@/components/shared/EditTripSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
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
import { syncFinancialState } from '@/lib/liveSync';
import { buildTruckOptions } from '@/lib/truckAvailability';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/components/providers/AuthProvider';
import { Trip, Truck as TruckType, Driver, Customer } from '@/types';

const tripSchema = z.object({
  truck_id: z.number().min(1, 'Please select a truck'),
  trailer_id: z.number().nullable().optional(),
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

interface TripListResponse {
  data: Trip[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  stats?: Record<string, number>;
}

const statusOptions = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function TripsPage() {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = useAuth();
  const canManage = isOwner || isManager;

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState('start_date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, truckFilter, driverFilter, customerFilter, fromDate, toDate, sort, direction, perPage]);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<TripListResponse>({
    queryKey: [
      'trips',
      statusFilter,
      search,
      truckFilter,
      driverFilter,
      customerFilter,
      fromDate,
      toDate,
      sort,
      direction,
      page,
      perPage,
    ],
    queryFn: () =>
      api.get<TripListResponse>('/trips', {
        status: statusFilter,
        search,
        truck_id: truckFilter || undefined,
        driver_id: driverFilter || undefined,
        customer_id: customerFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        sort,
        direction,
        page,
        per_page: perPage,
      }),
    refetchInterval: 30000,
  });

  const trips = data?.data || [];
  const stats = data?.stats;
  const totalTrips = data?.total ?? trips.length;

  // Options for modal dropdowns and filters
  const { data: trucksData } = useQuery<{ data: TruckType[] }>({
    queryKey: ['trucks-list'],
    queryFn: () => api.get<{ data: TruckType[] }>('/trucks', { per_page: 100 }),
  });

  const { data: activeTripsData } = useQuery<{ data: Trip[] }>({
    queryKey: ['active-trips-select'],
    queryFn: () => api.get<{ data: Trip[] }>('/trips', { status: 'active', per_page: 100 }),
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

  // Watch selected truck to prefill starting odometer and coupled trailer
  const selectedTruckId = watch('truck_id');
  const tripStartDate = watch('start_date');
  const tripEndDate = watch('end_date');
  const selectedTruck = trucksData?.data?.find((t) => t.id === Number(selectedTruckId));
  const truckOptions = buildTruckOptions(
    trucksData?.data ?? [],
    activeTripsData?.data ?? [],
    tripStartDate,
    tripEndDate
  );
  const selectedTruckOption = truckOptions.find(
    (option) => option.truck.id === Number(selectedTruckId)
  );
  React.useEffect(() => {
    if (selectedTruck) {
      if (selectedTruck.odometer_km) {
        setValue('start_odometer', selectedTruck.odometer_km);
      }
      setValue('trailer_id', selectedTruck.current_assignment?.trailer_id ?? null);
    }
  }, [selectedTruck, setValue]);

  const invalidateTrips = () => {
    syncFinancialState(queryClient);
  };

  const createMutation = useMutation({
    mutationFn: (newTrip: TripFormData) => api.post('/trips', newTrip),
    onSuccess: () => {
      invalidateTrips();
      toast.success('Trip created and dispatched successfully');
      setSheetOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create trip');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (trip: Trip) => api.delete<{ message?: string }>(`/trips/${trip.id}`),
    onSuccess: (response) => {
      invalidateTrips();
      toast.success(response?.message || 'Trip removed successfully');
      setTripToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete trip');
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (trip: Trip) =>
      api.post('/trips/bulk-status', {
        trip_ids: [trip.id],
        status: 'in_transit',
        reason: 'Dispatched from trips table',
      }),
    onSuccess: () => {
      invalidateTrips();
      toast.success('Trip marked as in transit');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update trip status');
    },
  });

  const onSubmit = (formData: TripFormData) => {
    createMutation.mutate(formData);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    search.length > 0 ||
    !!truckFilter ||
    !!driverFilter ||
    !!customerFilter ||
    !!fromDate ||
    !!toDate;

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchInput('');
    setSearch('');
    setTruckFilter('');
    setDriverFilter('');
    setCustomerFilter('');
    setFromDate('');
    setToDate('');
    setSort('start_date');
    setDirection('desc');
  };

  const renderRowActions = (trip: Trip) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/trips/${trip.id}`} className="flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5" />
            View P&L details
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onClick={() => setEditTrip(trip)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Edit trip
          </DropdownMenuItem>
        )}
        {canManage && trip.status === 'planned' && (
          <DropdownMenuItem onClick={() => dispatchMutation.mutate(trip)} className="gap-2">
            <PlayCircle className="h-3.5 w-3.5" />
            Mark in transit
          </DropdownMenuItem>
        )}
        {isOwner && trip.status === 'planned' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTripToDelete(trip)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete trip
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips & Dispatch"
        description="The central record of truth linking truck, trailer, driver, customer, agreed revenue, and every trip expense."
        actions={
          <Button onClick={() => setSheetOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Create Trip</span>
          </Button>
        }
      />

      {/* Live status bar */}
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          Live dispatch data · auto-refresh every 30s
          {dataUpdatedAt ? ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-7 px-2 text-[11px]"
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Toolbar & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ref, route, cargo, plate, driver..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className="h-9 text-xs"
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs">
                Clear
              </Button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl border border-border bg-card">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Truck</label>
              <select
                value={truckFilter}
                onChange={(e) => setTruckFilter(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All trucks</option>
                {trucksData?.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reg_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Driver</label>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All drivers</option>
                {driversData?.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Customer</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All customers</option>
                {customersData?.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Sort By</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="start_date">Start date</option>
                <option value="end_date">End date</option>
                <option value="agreed_rate">Agreed rate</option>
                <option value="reference">Reference</option>
                <option value="status">Status</option>
                <option value="created_at">Date created</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}
                className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="desc">Newest / highest first</option>
                <option value="asc">Oldest / lowest first</option>
              </select>
            </div>
          </div>
        )}

        {/* Status Filter Chips with live counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {statusOptions.map((st) => {
            const count = st.key === 'all' ? stats?.all : stats?.[st.key];
            return (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-3 py-1.5 rounded-full capitalize font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                  statusFilter === st.key
                    ? 'bg-primary text-white border-primary font-semibold shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {st.label}
                {typeof count === 'number' && (
                  <span
                    className={`ml-1.5 tabular-nums ${
                      statusFilter === st.key ? 'text-white/80' : 'text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
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
          description={
            hasActiveFilters
              ? 'No trips match the current filters. Try clearing them.'
              : 'Create your first haulage trip to begin.'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : 'Create Trip'}
          onAction={hasActiveFilters ? resetFilters : () => setSheetOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                <th className="py-3 px-4 text-left font-medium">Route & Dates</th>
                <th className="py-3 px-4 text-left font-medium">Truck, Trailer & Driver</th>
                <th className="py-3 px-4 text-left font-medium">Customer & Cargo</th>
                <th className="py-3 px-4 text-right font-medium">Revenue (KES)</th>
                <th className="py-3 px-4 text-right font-medium">Direct Costs</th>
                <th className="py-3 px-4 text-right font-semibold text-success">Contribution</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
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
                    {trip.trailer?.reg_number && (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Trailer {trip.trailer.reg_number}
                      </p>
                    )}
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
                  <td className="py-3.5 px-4 text-right">{renderRowActions(trip)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{data.from ?? 0}</span>–
            <span className="font-semibold text-foreground">{data.to ?? 0}</span> of{' '}
            <span className="font-semibold text-foreground">{totalTrips}</span> trips
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Rows</label>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="h-8 px-2 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[10, 15, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={data.current_page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Page <span className="font-semibold text-foreground">{data.current_page}</span> of{' '}
              <span className="font-semibold text-foreground">{data.last_page}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={data.current_page >= data.last_page}
              onClick={() => setPage((p) => Math.min(data.last_page, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
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
                {truckOptions.map(({ truck: t, disabled, reason, note }) => (
                  <option key={t.id} value={t.id} disabled={disabled}>
                    {t.reg_number} — {t.make} {t.model}
                    {disabled ? ` — ${reason}` : note ? ` — ${note}` : ` (${t.status})`}
                  </option>
                ))}
              </select>
              {errors.truck_id && (
                <p className="text-[11px] text-destructive mt-1">{errors.truck_id.message}</p>
              )}
              {selectedTruckOption?.disabled && (
                <p className="text-[11px] text-destructive mt-1">
                  {selectedTruckOption.reason}. Pick another truck or adjust the dates.
                </p>
              )}
              {selectedTruck?.current_assignment?.trailer && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Coupled trailer{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {selectedTruck.current_assignment.trailer.reg_number}
                  </span>{' '}
                  will be dispatched with this trip.
                </p>
              )}
              {selectedTruck && !selectedTruck.current_assignment && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  This truck head has no trailer coupled; the trip will be recorded as head-only.
                </p>
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
              <Button
                type="submit"
                disabled={createMutation.isPending || !!selectedTruckOption?.disabled}
              >
                {createMutation.isPending ? 'Scheduling...' : 'Dispatch Trip'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {editTrip && (
        <EditTripSheet
          trip={editTrip}
          trucks={trucksData?.data ?? []}
          activeTrips={activeTripsData?.data ?? []}
          drivers={driversData?.data ?? []}
          customers={customersData?.data ?? []}
          open={!!editTrip}
          onOpenChange={(open) => !open && setEditTrip(null)}
        />
      )}

      <ConfirmDialog
        open={!!tripToDelete}
        onOpenChange={(open) => !open && setTripToDelete(null)}
        title={`Delete trip ${tripToDelete?.reference ?? ''}?`}
        description="Only planned trips can be deleted. This action is recorded in the audit trail and cannot be undone."
        confirmLabel="Delete Trip"
        onConfirm={() => tripToDelete && deleteMutation.mutate(tripToDelete)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
