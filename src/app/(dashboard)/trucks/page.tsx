'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Truck as TruckIcon,
  Container,
  Plus,
  LayoutGrid,
  List,
  Search,
  ArrowUpRight,
  Link2,
  Unlink,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TrailersPanel } from '@/components/fleet/TrailersPanel';
import { CouplingDialog } from '@/components/fleet/CouplingDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
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
import { formatKm } from '@/lib/formatters';
import { useAuth } from '@/components/providers/AuthProvider';
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

interface TruckListResponse {
  data: Truck[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  stats?: {
    all: number;
    available: number;
    on_trip: number;
    maintenance: number;
    inactive: number;
  };
}

const emptyTruckForm: TruckFormData = {
  reg_number: '',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  type: 'Prime Mover',
  capacity_tons: 28,
  odometer_km: 0,
  status: 'available',
};

const statusOptions = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'inactive', label: 'Inactive' },
];

export default function TrucksPage() {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = useAuth();
  const canManage = isOwner || isManager;

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [couplingFilter, setCouplingFilter] = useState('all');
  const [sort, setSort] = useState('reg_number');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [truckToDelete, setTruckToDelete] = useState<Truck | null>(null);
  const [fleetTab, setFleetTab] = useState<'heads' | 'trailers'>('heads');
  const [coupleTruck, setCoupleTruck] = useState<Truck | null>(null);
  const [uncoupleTruck, setUncoupleTruck] = useState<Truck | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, couplingFilter, sort, direction, perPage]);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<TruckListResponse>({
    queryKey: [
      'trucks',
      statusFilter,
      typeFilter,
      couplingFilter,
      sort,
      direction,
      search,
      page,
      perPage,
    ],
    queryFn: () =>
      api.get<TruckListResponse>('/trucks', {
        status: statusFilter,
        search,
        type: typeFilter === 'all' ? undefined : typeFilter,
        coupled: couplingFilter === 'all' ? undefined : couplingFilter,
        sort,
        direction,
        page,
        per_page: perPage,
      }),
    refetchInterval: 30000,
  });

  const trucks = data?.data || [];
  const meta = data?.meta;
  const stats = data?.stats;
  const totalHeads = meta?.total ?? trucks.length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TruckFormData>({
    resolver: zodResolver(truckSchema),
    defaultValues: emptyTruckForm,
  });

  const invalidateFleet = () => {
    queryClient.invalidateQueries({ queryKey: ['trucks'] });
    queryClient.invalidateQueries({ queryKey: ['trucks-list'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (newTruck: TruckFormData) => api.post('/trucks', newTruck),
    onSuccess: () => {
      invalidateFleet();
      toast.success('Truck registered into fleet successfully');
      setSheetOpen(false);
      reset(emptyTruckForm);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register truck');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: TruckFormData) =>
      api.put(`/trucks/${editingTruck?.id}`, {
        ...payload,
        version: editingTruck?.version ?? 1,
      }),
    onSuccess: () => {
      invalidateFleet();
      toast.success('Truck details updated successfully');
      setSheetOpen(false);
      setEditingTruck(null);
      reset(emptyTruckForm);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update truck');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (truck: Truck) => api.delete<{ message?: string }>(`/trucks/${truck.id}`),
    onSuccess: (response) => {
      invalidateFleet();
      toast.success(response?.message || 'Truck removed successfully');
      setTruckToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete truck');
    },
  });

  const openCreate = () => {
    setEditingTruck(null);
    reset(emptyTruckForm);
    setSheetOpen(true);
  };

  const openEdit = (truck: Truck) => {
    setEditingTruck(truck);
    reset({
      reg_number: truck.reg_number,
      make: truck.make,
      model: truck.model,
      year: Number(truck.year),
      type: truck.type,
      capacity_tons: Number(truck.capacity_tons),
      odometer_km: Number(truck.odometer_km),
      status: truck.status,
    });
    setSheetOpen(true);
  };

  const onSubmit = (formData: TruckFormData) => {
    if (editingTruck) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasActiveFilters =
    statusFilter !== 'all' || typeFilter !== 'all' || couplingFilter !== 'all' || search.length > 0;

  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setCouplingFilter('all');
    setSearchInput('');
    setSearch('');
    setSort('reg_number');
    setDirection('asc');
  };

  const renderRowActions = (truck: Truck) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/trucks/${truck.id}`} className="flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5" />
            View performance
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onClick={() => openEdit(truck)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Edit truck
          </DropdownMenuItem>
        )}
        {truck.current_assignment ? (
          <DropdownMenuItem onClick={() => setUncoupleTruck(truck)} className="gap-2">
            <Unlink className="h-3.5 w-3.5" />
            Uncouple trailer
          </DropdownMenuItem>
        ) : (
          canManage && (
            <DropdownMenuItem onClick={() => setCoupleTruck(truck)} className="gap-2">
              <Link2 className="h-3.5 w-3.5" />
              Couple trailer
            </DropdownMenuItem>
          )
        )}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTruckToDelete(truck)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete truck
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Management"
        description="Manage truck heads and trailers as separate assets, then couple them into compliant haulage combinations."
        actions={
          fleetTab === 'heads' ? (
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

              <Button onClick={openCreate} size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                <span>Add Truck Head</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Fleet Segmented Tabs */}
      <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 shadow-sm">
        <button
          onClick={() => setFleetTab('heads')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            fleetTab === 'heads'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TruckIcon className="h-4 w-4" />
          Truck Heads ({totalHeads})
        </button>
        <button
          onClick={() => setFleetTab('trailers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            fleetTab === 'trailers'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Container className="h-4 w-4" />
          Trailers
        </button>
      </div>

      {fleetTab === 'trailers' ? (
        <TrailersPanel />
      ) : (
        <>
          {/* Live status bar */}
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Live fleet data · auto-refresh every 30s
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

          {/* Filters & Search Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plate (e.g. KDA 482B), make, model..."
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
                  {hasActiveFilters && (
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
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
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All types</option>
                    <option value="Prime Mover">Prime Mover</option>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Box Truck">Box Truck</option>
                    <option value="Tipper">Tipper</option>
                    <option value="Tanker">Tanker</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Coupling
                  </label>
                  <select
                    value={couplingFilter}
                    onChange={(e) => setCouplingFilter(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All heads</option>
                    <option value="yes">Coupled</option>
                    <option value="no">Uncoupled</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Sort By
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="reg_number">Plate number</option>
                    <option value="odometer_km">Odometer</option>
                    <option value="year">Year</option>
                    <option value="completed_trips">Completed trips</option>
                    <option value="created_at">Date added</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}
                    className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>
            )}

            {/* Status Filter Chips with live counts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {statusOptions.map((st) => {
                const count =
                  st.key === 'all'
                    ? stats?.all
                    : stats?.[st.key as keyof NonNullable<typeof stats>];
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
              description={
                hasActiveFilters
                  ? 'No vehicles match the current filters. Try clearing them.'
                  : 'Get started by adding your first truck.'
              }
              actionLabel={hasActiveFilters ? 'Clear Filters' : 'Add Truck'}
              onAction={hasActiveFilters ? resetFilters : openCreate}
            />
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Plate Number</th>
                    <th className="py-3 px-4 text-left font-medium">Vehicle Specs</th>
                    <th className="py-3 px-4 text-left font-medium">Type & Capacity</th>
                    <th className="py-3 px-4 text-left font-medium">Coupled Trailer</th>
                    <th className="py-3 px-4 text-right font-medium">Odometer</th>
                    <th className="py-3 px-4 text-center font-semibold text-primary">Trips Made</th>
                    <th className="py-3 px-4 text-center font-medium">Status</th>
                    <th className="py-3 px-4 text-right font-medium">Actions</th>
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
                      <td className="py-3.5 px-4">
                        {truck.current_assignment?.trailer ? (
                          <div>
                            <p className="font-mono text-xs font-bold text-foreground">
                              {truck.current_assignment.trailer.reg_number}
                            </p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {truck.current_assignment.trailer.type.replace('_', ' ')} •{' '}
                              {truck.current_assignment.trailer.capacity_tons}t
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCoupleTruck(truck)}
                            className="h-7 px-2 text-[11px]"
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Couple
                          </Button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                        {formatKm(truck.odometer_km)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                          {truck.completed_trips ?? 0} completed
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={truck.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">{renderRowActions(truck)}</td>
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

                    {/* Coupled Trailer */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/70 border border-border">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Container className="h-3.5 w-3.5" />
                        Trailer
                      </span>
                      {truck.current_assignment?.trailer ? (
                        <span className="font-mono text-xs font-bold text-foreground">
                          {truck.current_assignment.trailer.reg_number}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCoupleTruck(truck)}
                          className="h-6 px-2 text-[10px]"
                        >
                          <Link2 className="mr-1 h-3 w-3" />
                          Couple
                        </Button>
                      )}
                    </div>

                    {/* Prominent Trips Made indicator */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/70 border border-border">
                      <span className="text-xs font-medium text-muted-foreground">Trips Completed</span>
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {truck.completed_trips ?? 0} trips
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/trucks/${truck.id}`}>
                          <span>View Performance & Trips</span>
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(truck)}
                          title="Edit truck"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {truck.current_assignment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUncoupleTruck(truck)}
                          className="text-destructive hover:text-destructive"
                          title="Uncouple trailer"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{meta.from ?? 0}</span>–
                <span className="font-semibold text-foreground">{meta.to ?? 0}</span> of{' '}
                <span className="font-semibold text-foreground">{meta.total}</span> truck heads
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
                  disabled={meta.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Page <span className="font-semibold text-foreground">{meta.current_page}</span> of{' '}
                  <span className="font-semibold text-foreground">{meta.last_page}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Add / Edit Truck Drawer */}
          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) setEditingTruck(null);
            }}
          >
            <SheetContent side="right" className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>
                  {editingTruck ? `Edit Truck ${editingTruck.reg_number}` : 'Register New Truck'}
                </SheetTitle>
                <SheetDescription>
                  {editingTruck
                    ? 'Update vehicle specifications. Changes are audit-logged against your user account.'
                    : 'Add a commercial vehicle to your fleet roster.'}
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
                  <label className="text-xs font-semibold text-foreground block mb-1">Status</label>
                  <select
                    {...register('status')}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="available">Available</option>
                    <option value="on_trip">On Trip</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {editingTruck?.current_assignment && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Currently coupled to {editingTruck.current_assignment.trailer?.reg_number}. Uncouple before
                      deactivating.
                    </p>
                  )}
                </div>

                <SheetFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSheetOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving
                      ? 'Saving...'
                      : editingTruck
                        ? 'Save Changes'
                        : 'Register Vehicle'}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>

          <ConfirmDialog
            open={!!truckToDelete}
            onOpenChange={(open) => !open && setTruckToDelete(null)}
            title={`Delete ${truckToDelete?.reg_number ?? 'truck'}?`}
            description="Trucks with trip history cannot be permanently deleted; they will be marked inactive instead. This action is recorded in the audit log."
            confirmLabel="Delete Truck"
            onConfirm={() => truckToDelete && deleteMutation.mutate(truckToDelete)}
            isLoading={deleteMutation.isPending}
          />
        </>
      )}

      <CouplingDialog
        mode="couple"
        truck={coupleTruck}
        open={!!coupleTruck}
        onOpenChange={(open) => !open && setCoupleTruck(null)}
      />
      <CouplingDialog
        mode="uncouple"
        truck={uncoupleTruck}
        open={!!uncoupleTruck}
        onOpenChange={(open) => !open && setUncoupleTruck(null)}
      />
    </div>
  );
}
