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
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
  Check,
  Container,
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
import { validateIso6346, normalizeContainerNumber } from '@/lib/iso6346';
import { Trip, Truck as TruckType, Driver, Customer, StagedUploadResponse } from '@/types';

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

  // Container & Documents state (Directive 3, 5, 6, 11)
  const [isContainerTrip, setIsContainerTrip] = useState(false);
  const [expectedContainers, setExpectedContainers] = useState<number>(1);
  const [addEir, setAddEir] = useState(true);
  const [eirNumber, setEirNumber] = useState('');
  const [eirContainerNumber, setEirContainerNumber] = useState('');
  const [eirSize, setEirSize] = useState<'20' | '40' | '40HC'>('40');
  const [eirType, setEirType] = useState<'dry' | 'reefer' | 'other'>('dry');
  const [eirSeal, setEirSeal] = useState('');
  const [eirDepot, setEirDepot] = useState('Mombasa Port Terminal 2');
  const [eirFile, setEirFile] = useState<File | null>(null);
  const [eirIsoOverride, setEirIsoOverride] = useState(false);
  const [eirIsoReason, setEirIsoReason] = useState('');

  // Delivery Note collapsible state ("Add later" - Directive 6)
  const [showDnSection, setShowDnSection] = useState(false);
  const [dnNumber, setDnNumber] = useState('');
  const [dnDeliveredAt, setDnDeliveredAt] = useState('');
  const [dnReceiverName, setDnReceiverName] = useState('');
  const [dnReceiverPhone, setDnReceiverPhone] = useState('');
  const [dnLocation, setDnLocation] = useState('');
  const [dnSigned, setDnSigned] = useState(false);
  const [dnFile, setDnFile] = useState<File | null>(null);

  // Live ISO 6346 validation (Directive 11)
  const isoStatus = React.useMemo(() => {
    if (!eirContainerNumber.trim()) return null;
    return validateIso6346(eirContainerNumber);
  }, [eirContainerNumber]);

  const createMutation = useMutation({
    mutationFn: (newTrip: any) => api.post('/trips', newTrip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast.success('Trip created and dispatched successfully');
      setSheetOpen(false);
      reset();
      setIsContainerTrip(false);
      setEirNumber('');
      setEirContainerNumber('');
      setEirFile(null);
      setDnNumber('');
      setDnFile(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create trip');
    },
  });

  const stageUpload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload<StagedUploadResponse>('/uploads/stage', fd);
    return res.data.token;
  };

  const onSubmit = async (formData: TripFormData) => {
    try {
      const documents: any[] = [];

      if (isContainerTrip && addEir && eirNumber.trim()) {
        const tokens: string[] = [];
        if (eirFile) {
          const token = await stageUpload(eirFile);
          tokens.push(token);
        }

        documents.push({
          type: 'container_interchange',
          document_number: eirNumber.trim(),
          issued_date: formData.start_date,
          container_number: eirContainerNumber.trim() ? normalizeContainerNumber(eirContainerNumber) : undefined,
          container_size: eirSize,
          container_type: eirType,
          seal_number: eirSeal.trim() || undefined,
          interchange_direction: 'out',
          depot_or_terminal: eirDepot.trim() || undefined,
          iso_check_digit_overridden: eirIsoOverride,
          iso_override_reason: eirIsoOverride ? eirIsoReason : undefined,
          staged_tokens: tokens,
        });
      }

      if (showDnSection && dnNumber.trim()) {
        const tokens: string[] = [];
        if (dnFile) {
          const token = await stageUpload(dnFile);
          tokens.push(token);
        }

        documents.push({
          type: 'delivery_note',
          document_number: dnNumber.trim(),
          issued_date: formData.start_date,
          delivered_at: dnDeliveredAt || undefined,
          receiver_name: dnReceiverName.trim() || undefined,
          receiver_phone: dnReceiverPhone.trim() || undefined,
          delivery_location: dnLocation.trim() || undefined,
          signed: dnSigned,
          staged_tokens: tokens,
        });
      }

      createMutation.mutate({
        ...formData,
        is_container_trip: isContainerTrip,
        expected_container_count: isContainerTrip ? expectedContainers : 1,
        documents: documents.length > 0 ? documents : undefined,
      });
    } catch (err: any) {
      toast.error(err.message || 'Error uploading document file');
    }
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
                <th className="py-3 px-4 text-left font-medium">Documents</th>
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
                    <Link href={`/trips/${trip.id}`} className="hover:underline">
                      {trip.reference}
                    </Link>
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
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1 text-[11px]">
                      {trip.documents && trip.documents.length > 0 ? (
                        trip.documents.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px]"
                          >
                            {d.type === 'delivery_note' ? 'DN' : 'EIR'}: {d.document_number}
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                d.status === 'verified'
                                  ? 'bg-success'
                                  : d.status === 'received'
                                  ? 'bg-primary'
                                  : 'bg-warning'
                              }`}
                            />
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Pending</span>
                      )}
                    </div>
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

            {/* Advancement D: Trip Documents & Container Section */}
            <div className="pt-2 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Container className="h-4 w-4 text-primary" />
                    Containerized Trip Configuration
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Enable for shipping line container haulage requiring interchange receipts.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isContainerTrip}
                  onChange={(e) => setIsContainerTrip(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {isContainerTrip && (
                <div className="p-3.5 rounded-xl bg-secondary/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Expected Containers</label>
                    <select
                      value={expectedContainers}
                      onChange={(e) => setExpectedContainers(Number(e.target.value))}
                      className="h-8 px-2 rounded-lg border border-input bg-card text-xs font-semibold"
                    >
                      <option value={1}>1 Container (Standard)</option>
                      <option value={2}>2 Containers (Double 20ft)</option>
                    </select>
                  </div>

                  {/* Gate-Out EIR (Directive 6: Shown by default for container trips) */}
                  <div className="p-3 rounded-lg bg-card border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Gate-Out EIR Receipt</span>
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Required Before Dispatch
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">EIR Document #</label>
                        <Input
                          placeholder="e.g. EIR-8821"
                          value={eirNumber}
                          onChange={(e) => setEirNumber(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Depot / Terminal</label>
                        <Input
                          placeholder="e.g. KPA Terminal 2"
                          value={eirDepot}
                          onChange={(e) => setEirDepot(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[11px] font-medium text-foreground">Container Number (ISO 6346)</label>
                        {isoStatus && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isoStatus.isValid
                                ? 'bg-success/15 text-success'
                                : 'bg-warning/15 text-warning'
                            }`}
                          >
                            {isoStatus.isValid ? 'ISO Valid ✓' : `Check digit mismatch (expected ${isoStatus.expectedCheckDigit})`}
                          </span>
                        )}
                      </div>
                      <Input
                        placeholder="e.g. MSCU1234566"
                        value={eirContainerNumber}
                        onChange={(e) => setEirContainerNumber(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-mono uppercase"
                      />
                      {isoStatus && !isoStatus.isValid && (
                        <div className="mt-1.5 p-2 rounded bg-warning/10 border border-warning/20 text-[11px] text-warning space-y-1">
                          <p>{isoStatus.message}</p>
                          <label className="flex items-center gap-1.5 cursor-pointer text-foreground font-medium">
                            <input
                              type="checkbox"
                              checked={eirIsoOverride}
                              onChange={(e) => setEirIsoOverride(e.target.checked)}
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <span>Override ISO check digit with justification note</span>
                          </label>
                          {eirIsoOverride && (
                            <Input
                              placeholder="Reason (e.g. Discrepancy on shipping line EIR paper copy)"
                              value={eirIsoReason}
                              onChange={(e) => setEirIsoReason(e.target.value)}
                              className="h-7 text-[11px] bg-background mt-1"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Size</label>
                        <select
                          value={eirSize}
                          onChange={(e) => setEirSize(e.target.value as any)}
                          className="w-full h-8 px-2 rounded-lg border border-input bg-card text-xs font-mono"
                        >
                          <option value="20">20ft</option>
                          <option value="40">40ft</option>
                          <option value="40HC">40ft High Cube</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Type</label>
                        <select
                          value={eirType}
                          onChange={(e) => setEirType(e.target.value as any)}
                          className="w-full h-8 px-2 rounded-lg border border-input bg-card text-xs"
                        >
                          <option value="dry">Dry</option>
                          <option value="reefer">Reefer</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Seal Number</label>
                        <Input
                          placeholder="SL-1029"
                          value={eirSeal}
                          onChange={(e) => setEirSeal(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Attach Scan / Photo (Max 10MB)</label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                        onChange={(e) => setEirFile(e.target.files?.[0] || null)}
                        className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                      />
                      {eirFile && (
                        <p className="text-[10px] text-success mt-0.5">Selected: {eirFile.name} ({(eirFile.size / 1024).toFixed(0)} KB)</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Note Collapsible (Directive 6: Add later) */}
              <div className="p-3 rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setShowDnSection(!showDnSection)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-bold text-foreground">Delivery Note</span>
                      <span className="ml-2 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        Typically recorded upon arrival
                      </span>
                    </div>
                  </div>
                  {showDnSection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {showDnSection && (
                  <div className="pt-3 mt-3 border-t border-border space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Delivery Note #</label>
                        <Input
                          placeholder="e.g. DN-1042"
                          value={dnNumber}
                          onChange={(e) => setDnNumber(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Delivery Date/Time</label>
                        <Input
                          type="datetime-local"
                          value={dnDeliveredAt}
                          onChange={(e) => setDnDeliveredAt(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Receiver Name</label>
                        <Input
                          placeholder="Receiver person name"
                          value={dnReceiverName}
                          onChange={(e) => setDnReceiverName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-foreground block mb-0.5">Receiver Phone</label>
                        <Input
                          placeholder="+2547..."
                          value={dnReceiverPhone}
                          onChange={(e) => setDnReceiverPhone(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Delivery Location / Warehouse</label>
                      <Input
                        placeholder="e.g. Bamburi Warehouse Bay 3"
                        value={dnLocation}
                        onChange={(e) => setDnLocation(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={dnSigned}
                          onChange={(e) => setDnSigned(e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary"
                        />
                        <span>Physical signature confirmed on delivery document</span>
                      </label>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Attach Delivery Note Scan</label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                        onChange={(e) => setDnFile(e.target.files?.[0] || null)}
                        className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                      />
                      {dnFile && (
                        <p className="text-[10px] text-success mt-0.5">Selected: {dnFile.name} ({(dnFile.size / 1024).toFixed(0)} KB)</p>
                      )}
                    </div>
                  </div>
                )}
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

