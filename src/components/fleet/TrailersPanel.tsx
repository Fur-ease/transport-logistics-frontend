'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Container,
  Plus,
  Search,
  ArrowUpRight,
  Link2,
  Weight,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
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
import { useAuth } from '@/components/providers/AuthProvider';
import { Trailer } from '@/types';

const optionalNumber = z.preprocess(
  (value) =>
    value === '' || value === undefined || value === null || Number.isNaN(Number(value))
      ? null
      : Number(value),
  z.number().min(0, 'Enter a valid weight').nullable()
) as z.ZodType<number | null>;

const trailerSchema = z.object({
  reg_number: z.string().min(4, 'Enter a valid Kenya plate number (e.g. ZE 4412)'),
  type: z.string().min(2, 'Trailer type is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().min(1990).max(new Date().getFullYear() + 1),
  capacity_tons: z.number().min(0.5, 'Enter valid payload capacity in tons'),
  tare_weight_tons: optionalNumber,
  status: z.enum(['available', 'in_use', 'maintenance', 'inactive']),
  reason: z.string().optional(),
});

type TrailerFormData = z.infer<typeof trailerSchema>;

interface TrailerListResponse {
  data: Trailer[];
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
    in_use: number;
    maintenance: number;
    inactive: number;
  };
}

const emptyTrailerForm: TrailerFormData = {
  reg_number: '',
  type: 'skeletal',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  capacity_tons: 30,
  tare_weight_tons: null,
  status: 'available',
  reason: '',
};

const trailerTypes = [
  { value: 'skeletal', label: 'Skeletal (Container)' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'curtain_side', label: 'Curtain Side' },
  { value: 'tanker', label: 'Tanker' },
  { value: 'lowboy', label: 'Lowboy' },
  { value: 'box', label: 'Box Trailer' },
  { value: 'side_tipper', label: 'Side Tipper' },
  { value: 'other', label: 'Other' },
];

const statusOptions = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'in_use', label: 'In Use' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'inactive', label: 'Inactive' },
];

export function TrailersPanel() {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = useAuth();
  const canManage = isOwner || isManager;

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
  const [editingTrailer, setEditingTrailer] = useState<Trailer | null>(null);
  const [trailerToDelete, setTrailerToDelete] = useState<Trailer | null>(null);

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

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<TrailerListResponse>({
    queryKey: [
      'trailers',
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
      api.get<TrailerListResponse>('/trailers', {
        status: statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        coupled: couplingFilter === 'all' ? undefined : couplingFilter,
        sort,
        direction,
        search,
        page,
        per_page: perPage,
      }),
    refetchInterval: 30000,
  });

  const trailers = data?.data || [];
  const meta = data?.meta;
  const stats = data?.stats;
  const totalTrailers = meta?.total ?? trailers.length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrailerFormData>({
    resolver: zodResolver(trailerSchema) as unknown as Resolver<TrailerFormData>,
    defaultValues: emptyTrailerForm,
  });

  const invalidateTrailers = () => {
    queryClient.invalidateQueries({ queryKey: ['trailers'] });
    queryClient.invalidateQueries({ queryKey: ['trucks'] });
    queryClient.invalidateQueries({ queryKey: ['trucks-list'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: TrailerFormData) => {
      const { reason, ...body } = payload;
      return api.post('/trailers', body);
    },
    onSuccess: () => {
      invalidateTrailers();
      toast.success('Trailer registered into the fleet successfully');
      setSheetOpen(false);
      reset(emptyTrailerForm);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to register trailer'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: TrailerFormData) =>
      api.put(`/trailers/${editingTrailer?.id}`, {
        ...payload,
        version: editingTrailer?.version ?? 1,
      }),
    onSuccess: () => {
      invalidateTrailers();
      toast.success('Trailer updated successfully');
      setSheetOpen(false);
      setEditingTrailer(null);
      reset(emptyTrailerForm);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update trailer'),
  });

  const deleteMutation = useMutation({
    mutationFn: (trailer: Trailer) => api.delete<{ message?: string }>(`/trailers/${trailer.id}`),
    onSuccess: (response) => {
      invalidateTrailers();
      toast.success(response?.message || 'Trailer removed successfully');
      setTrailerToDelete(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete trailer'),
  });

  const openCreate = () => {
    setEditingTrailer(null);
    reset(emptyTrailerForm);
    setSheetOpen(true);
  };

  const openEdit = (trailer: Trailer) => {
    setEditingTrailer(trailer);
    reset({
      reg_number: trailer.reg_number,
      type: trailer.type,
      make: trailer.make || '',
      model: trailer.model || '',
      year: Number(trailer.year) || new Date().getFullYear(),
      capacity_tons: Number(trailer.capacity_tons),
      tare_weight_tons: trailer.tare_weight_tons != null ? Number(trailer.tare_weight_tons) : null,
      status: trailer.status,
      reason: '',
    });
    setSheetOpen(true);
  };

  const onSubmit = (formData: TrailerFormData) => {
    if (editingTrailer) {
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

  const renderRowActions = (trailer: Trailer) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {trailer.active_assignment?.truck ? (
          <DropdownMenuItem asChild>
            <Link
              href={`/trucks/${trailer.active_assignment.truck.id}`}
              className="flex items-center gap-2"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              View coupled head
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/trucks" className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              Couple from fleet
            </Link>
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onClick={() => openEdit(trailer)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Edit trailer
          </DropdownMenuItem>
        )}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTrailerToDelete(trailer)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete trailer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      {/* Live status bar */}
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          Live trailer data · auto-refresh every 30s
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trailer plate, type, make..."
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
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            <span>Add Trailer</span>
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl border border-border bg-card">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Trailer Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All types</option>
              {trailerTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
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
              <option value="all">All trailers</option>
              <option value="yes">Coupled</option>
              <option value="no">Not coupled</option>
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
              <option value="capacity_tons">Capacity</option>
              <option value="year">Year</option>
              <option value="trips_count">Trips made</option>
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

      {/* Status chips with live counts */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
        {statusOptions.map((st) => {
          const count = st.key === 'all' ? stats?.all : stats?.[st.key as keyof NonNullable<typeof stats>];
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

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : trailers.length === 0 ? (
        <EmptyState
          icon={<Container className="h-8 w-8" />}
          title="No trailers found"
          description={
            hasActiveFilters
              ? 'No trailers match the current filters. Try clearing them.'
              : 'Register trailers separately from truck heads and couple them when needed.'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : 'Add Trailer'}
          onAction={hasActiveFilters ? resetFilters : openCreate}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Trailer Plate</th>
                <th className="py-3 px-4 text-left font-medium">Specs</th>
                <th className="py-3 px-4 text-left font-medium">Type & Capacity</th>
                <th className="py-3 px-4 text-left font-medium">Coupled To</th>
                <th className="py-3 px-4 text-center font-medium">Trips</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trailers.map((trailer) => (
                <tr key={trailer.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-bold text-sm text-foreground">{trailer.reg_number}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-foreground">
                      {trailer.make || '—'} {trailer.model || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{trailer.year || '—'}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-xs capitalize">{trailer.type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                      <Weight className="h-3 w-3" /> {trailer.capacity_tons} tons
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    {trailer.active_assignment?.truck ? (
                      <Link
                        href={`/trucks/${trailer.active_assignment.truck.id}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {trailer.active_assignment.truck.reg_number}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not coupled</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                      {trailer.trips_count ?? 0}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusBadge status={trailer.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">{renderRowActions(trailer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{meta.from ?? 0}</span>–
            <span className="font-semibold text-foreground">{meta.to ?? 0}</span> of{' '}
            <span className="font-semibold text-foreground">{totalTrailers}</span> trailers
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

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingTrailer(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editingTrailer ? `Edit Trailer ${editingTrailer.reg_number}` : 'Register New Trailer'}
            </SheetTitle>
            <SheetDescription>
              Trailers are independent assets with their own plate, capacity and service status.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Trailer Registration Plate (e.g. ZE 4412)
              </label>
              <Input
                placeholder="ZE 4412"
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
                <Input placeholder="Afrit / Tiger / CIMC" {...register('make')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Model</label>
                <Input placeholder="Superlink / Flat Deck" {...register('model')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Trailer Type</label>
                <select
                  {...register('type')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {trailerTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Year</label>
                <Input type="number" {...register('year', { valueAsNumber: true })} />
                {errors.year && (
                  <p className="text-[11px] text-destructive mt-1">{errors.year.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Payload Capacity (Tons)
                </label>
                <Input type="number" step="0.1" {...register('capacity_tons', { valueAsNumber: true })} />
                {errors.capacity_tons && (
                  <p className="text-[11px] text-destructive mt-1">{errors.capacity_tons.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Tare Weight (Tons)
                </label>
                <Input type="number" step="0.1" {...register('tare_weight_tons')} />
                {errors.tare_weight_tons && (
                  <p className="text-[11px] text-destructive mt-1">
                    {errors.tare_weight_tons.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Status</label>
              {editingTrailer?.active_assignment ? (
                <div className="h-10 px-3 flex items-center rounded-lg border border-border bg-secondary/60 text-sm text-foreground">
                  In Use — coupled to {editingTrailer.active_assignment.truck?.reg_number ?? 'a truck head'}
                </div>
              ) : (
                <select
                  {...register('status')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Status changes to In Use automatically when the trailer is coupled to a truck head.
              </p>
            </div>

            {editingTrailer && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Reason for Change
                </label>
                <Input
                  placeholder="Required when changing the plate number"
                  {...register('reason')}
                />
              </div>
            )}

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
                {isSaving ? 'Saving...' : editingTrailer ? 'Save Changes' : 'Register Trailer'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!trailerToDelete}
        onOpenChange={(open) => !open && setTrailerToDelete(null)}
        title={`Delete ${trailerToDelete?.reg_number ?? 'trailer'}?`}
        description="Trailers with coupling or trip history cannot be permanently deleted; they will be marked inactive instead. This action is recorded in the audit log."
        confirmLabel="Delete Trailer"
        onConfirm={() => trailerToDelete && deleteMutation.mutate(trailerToDelete)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
