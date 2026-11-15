'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  MapPin,
  User,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Plus,
  RefreshCw,
  Fuel,
  AlertTriangle,
  Receipt,
  FileCheck,
  ArrowRight,
  Edit3,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { TripStepper } from '@/components/shared/TripStepper';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { FileUpload } from '@/components/shared/FileUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditTripSheet } from '@/components/shared/EditTripSheet';
import { EditExpenseDialog } from '@/components/shared/EditExpenseDialog';
import { AdvanceAdjustmentDialog } from '@/components/shared/AdvanceAdjustmentDialog';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { CategorySelect } from '@/components/shared/CategorySelect';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, getFileUrl, openProtectedFile } from '@/lib/api';
import { formatKES, formatKm, formatDate, formatDateTime } from '@/lib/formatters';
import { LIVE_REFETCH_MS, syncFinancialState } from '@/lib/liveSync';
import { Trip, TripExpense, DriverAdvance, Truck, Driver, Customer } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';

const expenseSchema = z.object({
  category: z
    .string({ message: 'Expense category is required' })
    .min(1, 'Expense category is required')
    .max(50, 'Category is too long')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _\/&-]*$/, 'Invalid category name'),
  amount: z.number({ error: 'Amount in KES is required' }).min(1, 'Amount in KES is required'),
  litres: z.number().optional().nullable(),
  odometer_at_fill: z.number().optional().nullable(),
  incurred_at: z.string().min(1, 'Date and time required'),
  notes: z.string().optional().nullable(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface TripPnLResponse {
  revenue: number;
  approved_direct_costs: number;
  pending_costs: number;
  contribution: number;
  contribution_margin_pct: number;
  metric_label: string;
  disclaimer: string;
  breakdown_by_category: Record<string, number>;
  distance_km: number;
  revenue_per_km: number;
  cost_per_km: number;
  contribution_per_km: number;
}

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<File[]>([]);

  const openAddExpenseModal = () => {
    resetExpenseForm({
      category: '',
      amount: undefined as unknown as number,
      incurred_at: '',
      litres: undefined,
      odometer_at_fill: undefined,
      notes: '',
    });
    setSelectedReceipts([]);
    setAddExpenseOpen(true);
  };

  // Reassign modal state
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [expenseToReassign, setExpenseToReassign] = useState<TripExpense | null>(null);
  const [targetTripId, setTargetTripId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Status transition state (Mark delivered modal)
  const [deliveredModalOpen, setDeliveredModalOpen] = useState(false);
  const [endOdometer, setEndOdometer] = useState<number | ''>('');

  // Settle advance modal state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<DriverAdvance | null>(null);
  const [returnedAmount, setReturnedAmount] = useState<number | ''>('');

  // Safe editing states
  const [editTripSheetOpen, setEditTripSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [adjustingAdvance, setAdjustingAdvance] = useState<DriverAdvance | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'expenses' | 'history'>('expenses');

  // Fetch Trip details
  const {
    data: tripData,
    isLoading: isTripLoading,
    isFetching: isTripFetching,
    refetch: refetchTrip,
    dataUpdatedAt: tripUpdatedAt,
  } = useQuery<{ data: Trip }>({
    queryKey: ['trip', tripId],
    queryFn: () => api.get<{ data: Trip }>(`/trips/${tripId}`),
    refetchInterval: LIVE_REFETCH_MS,
  });

  // Fetch fleet options for edit sheet
  const { data: trucksData } = useQuery<{ data: Truck[] }>({
    queryKey: ['trucks-select'],
    queryFn: () => api.get<{ data: Truck[] }>('/trucks', { per_page: 100 }),
  });
  const { data: activeTripsData } = useQuery<{ data: Trip[] }>({
    queryKey: ['active-trips-select'],
    queryFn: () => api.get<{ data: Trip[] }>('/trips', { status: 'active', per_page: 100 }),
  });
  const { data: driversData } = useQuery<{ data: Driver[] }>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get<{ data: Driver[] }>('/drivers'),
  });
  const { data: customersData } = useQuery<{ data: Customer[] }>({
    queryKey: ['customers-select'],
    queryFn: () => api.get<{ data: Customer[] }>('/customers'),
  });

  // Fetch Trip P&L
  const { data: pnlData, isLoading: isPnlLoading, refetch: refetchPnl } = useQuery<{ data: TripPnLResponse }>({
    queryKey: ['trip-pnl', tripId],
    queryFn: () => api.get<{ data: TripPnLResponse }>(`/trips/${tripId}/pnl`),
    refetchInterval: LIVE_REFETCH_MS,
  });

  // Advancement C: Missing entries query for this trip
  const { data: tripIssuesResponse } = useQuery<{ data: Array<{ id: number; rule_key: string }> }>({
    queryKey: ['trip-issues', tripId],
    queryFn: () => api.get(`/missing-entries?trip_id=${tripId}&status=open`),
  });
  const tripIssues = tripIssuesResponse?.data || [];

  // Fetch all trips list for reassignment target select
  const { data: allTripsData } = useQuery<{ data: Trip[] }>({
    queryKey: ['all-trips-select'],
    queryFn: () => api.get<{ data: Trip[] }>('/trips?per_page=100'),
  });

  const trip = tripData?.data;
  const pnl = pnlData?.data;

  // Form for adding an expense
  const {
    register,
    handleSubmit,
    reset: resetExpenseForm,
    watch,
    control,
    setValue,
    formState: { errors: expenseErrors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: '',
      amount: undefined as unknown as number,
      incurred_at: '',
      notes: '',
    },
  });

  const watchCategory = watch('category');

  // Submit expense mutation
  const expenseMutation = useMutation({
    mutationFn: async (formData: ExpenseFormData) => {
      const data = new FormData();
      data.append('category', formData.category);
      data.append('amount', String(formData.amount));
      if (formData.litres !== undefined && formData.litres !== null && !isNaN(formData.litres)) {
        data.append('litres', String(formData.litres));
      }
      if (formData.odometer_at_fill !== undefined && formData.odometer_at_fill !== null && !isNaN(formData.odometer_at_fill)) {
        data.append('odometer_at_fill', String(formData.odometer_at_fill));
      }
      // send as ISO instant so stored/displayed time matches the selected local date & time
      data.append('incurred_at', new Date(formData.incurred_at).toISOString());
      if (formData.notes) data.append('notes', formData.notes);
      selectedReceipts.forEach((file) => data.append('receipts[]', file));

      return api.upload(`/trips/${tripId}/expenses`, data);
    },
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Expense recorded successfully');
      setAddExpenseOpen(false);
      resetExpenseForm({
        category: undefined as unknown as ExpenseFormData['category'],
        amount: undefined as unknown as number,
        incurred_at: '',
        litres: undefined,
        odometer_at_fill: undefined,
        notes: '',
      });
      setSelectedReceipts([]);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit expense');
    },
  });

  // Approve / Reject expense mutation
  const expenseStatusMutation = useMutation({
    mutationFn: ({ expenseId, status, reason }: { expenseId: number; status: string; reason?: string }) =>
      api.patch(`/expenses/${expenseId}/status`, { status, rejection_reason: reason }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Expense status updated');
    },
  });

  // Reassign expense mutation
  const reassignMutation = useMutation({
    mutationFn: ({ expenseId, targetTripId, reason }: { expenseId: number; targetTripId: number; reason: string }) =>
      api.post(`/expenses/${expenseId}/reassign`, { target_trip_id: targetTripId, reason }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Expense reassigned and logged in audit trail');
      setReassignModalOpen(false);
      setExpenseToReassign(null);
      setReassignReason('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reassign expense');
    },
  });

  // Update trip status mutation
  const tripStatusMutation = useMutation({
    mutationFn: (updates: { status: string; end_odometer?: number; end_date?: string }) =>
      api.put(`/trips/${tripId}`, updates),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Trip status updated');
      setDeliveredModalOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Status transition failed');
    },
  });

  // Settle advance mutation
  const settleAdvanceMutation = useMutation({
    mutationFn: ({ advanceId, returned }: { advanceId: number; returned: number }) =>
      api.post(`/advances/${advanceId}/settle`, { amount_returned: returned }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Driver advance settlement updated');
      setSettleModalOpen(false);
      setSelectedAdvance(null);
      setReturnedAmount('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Settlement failed');
    },
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: () => api.post('/invoices', { trip_id: Number(tripId) }),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      toast.success('Invoice generated for customer');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Invoice generation failed');
    },
  });

  if (isTripLoading || !trip) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span>{trip.reference} {trip.origin} to {trip.destination}</span>
        }
        description={
          <p className="text-sm md:text-base font-medium text-foreground mt-1 max-w-3xl">
            {trip.customer?.name} • Cargo: {trip.cargo_description} ({trip.cargo_weight_tons} tons) • Rate: {formatKES(trip.agreed_rate)}
          </p>
        }
        breadcrumbs={[
          { label: 'Trips & Dispatch', href: '/trips' },
          { label: trip.reference },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-900/60"
              onClick={() => setEditTripSheetOpen(true)}
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              <span>Edit Details</span>
            </Button>
            {trip.status === 'planned' && (
              <Button
                size="sm"
                onClick={() => tripStatusMutation.mutate({ status: 'in_transit' })}
                disabled={tripStatusMutation.isPending}
              >
                Dispatch / Start Trip
              </Button>
            )}

            {trip.status === 'in_transit' && (
              <Button
                size="sm"
                onClick={() => {
                  setEndOdometer(trip.truck?.odometer_km || trip.start_odometer);
                  setDeliveredModalOpen(true);
                }}
              >
                Mark as Delivered
              </Button>
            )}

            {trip.status === 'delivered' && !trip.invoice && (
              <Button
                size="sm"
                onClick={() => createInvoiceMutation.mutate()}
                disabled={createInvoiceMutation.isPending}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                <span>Issue Invoice</span>
              </Button>
            )}

            <Button
              variant="success"
              size="sm"
              onClick={openAddExpenseModal}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span>Add Expense</span>
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          Live trip P&L · auto-refresh every 15s
          {tripUpdatedAt ? ` · updated ${new Date(tripUpdatedAt).toLocaleTimeString()}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            refetchTrip();
            refetchPnl();
          }}
          className="h-7 px-2 text-[11px]"
          disabled={isTripFetching}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isTripFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Advancement C: Missing entries warning banner */}
      {tripIssues.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Data Quality Warning:</strong> {tripIssues.length} entry issue{tripIssues.length > 1 ? 's' : ''} detected on this trip. Profit sheet calculations may be incomplete.
            </span>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-500/40 hover:bg-amber-500/10 shrink-0 h-7 text-xs">
            <Link href={`/operations/missing-entries?trip_id=${tripId}&status=open`}>
              <span>Review &amp; Fix</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Stepper tracking Trip Lifecycle */}
      <Card className="p-4 bg-card">
        <TripStepper currentStatus={trip.status} />
      </Card>

      {/* Core Grid: Trip Information & P&L Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Route */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Dispatch Summary</span>
                <StatusBadge status={trip.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Truck Assigned</span>
                  <Link href={`/trucks/${trip.truck_id}`} className="font-mono font-bold text-sm text-primary hover:underline">
                    {trip.truck?.reg_number}
                  </Link>
                  <p className="text-muted-foreground mt-0.5">{trip.truck?.make} {trip.truck?.model}</p>
                  {trip.trailer && (
                    <p className="font-mono text-[11px] text-muted-foreground mt-1">
                      Trailer {trip.trailer.reg_number}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Driver</span>
                  <p className="font-semibold text-sm text-foreground">{trip.driver?.name}</p>
                  <p className="text-muted-foreground mt-0.5">{trip.driver?.phone}</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Customer</span>
                  <p className="font-semibold text-sm text-foreground">{trip.customer?.name}</p>
                  <p className="text-muted-foreground mt-0.5">{trip.customer?.phone}</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Distance Logged</span>
                  <p className="font-mono font-bold text-sm text-foreground tabular-nums">
                    {formatKm(trip.total_distance_km)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                    {trip.start_odometer} to {trip.end_odometer ?? '...'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Trip Dates</span>
                  <p className="font-semibold text-sm text-foreground">Start: {formatDate(trip.start_date)}</p>
                  <p className="text-muted-foreground mt-0.5">End: {trip.end_date ? formatDate(trip.end_date) : 'Not set'}</p>
                </div>
              </div>

              {trip.notes && (
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                  <strong>Notes:</strong> {trip.notes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Direct Expenses vs Audit History */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveBottomTab('expenses')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeBottomTab === 'expenses'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              Direct Expenses ({trip.expenses?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveBottomTab('history')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeBottomTab === 'history'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit History</span>
            </button>
          </div>

          {activeBottomTab === 'history' ? (
            <Card className="p-4 max-h-[520px] overflow-y-auto">
              <HistoryTimeline auditableType="trip" auditableId={trip.id} />
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Trip Direct Expenses</CardTitle>
                  <CardDescription>
                    Fuel, driver per diems, tolls, cess, and emergency repairs incurred on this trip
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openAddExpenseModal}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  <span>Add Expense</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border sticky top-0 z-10 backdrop-blur">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-medium">Category</th>
                        <th className="py-2.5 px-4 text-left font-medium">Details / Fuel Analysis</th>
                        <th className="py-2.5 px-4 text-right font-medium">Amount</th>
                        <th className="py-2.5 px-4 text-center font-medium">Status</th>
                        <th className="py-2.5 px-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {trip.expenses?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
                            No direct expenses recorded yet for this trip.
                          </td>
                        </tr>
                      ) : (
                        trip.expenses?.map((exp) => {
                          const receipts = (exp.receipts?.length ? exp.receipts : (exp as any).attachments) as any[] | undefined;
                          return (
                            <tr key={exp.id} className="hover:bg-muted/40 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-semibold text-foreground capitalize block">
                                  {exp.category.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDateTime(exp.incurred_at)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs align-top">
                                <div className="space-y-1.5 min-w-[220px]">
                                  <p className="text-muted-foreground">
                                    Entered by {exp.entered_by_name || 'Staff'}
                                  </p>
                                  {(exp.litres != null || exp.odometer_at_fill != null) && (
                                    <p className="font-mono text-[11px] text-foreground/80">
                                      {exp.litres != null ? `${exp.litres} L` : 'Fuel qty N/A'}
                                      {exp.odometer_at_fill != null ? ` @ Odo ${exp.odometer_at_fill} km` : ''}
                                    </p>
                                  )}
                                  {exp.notes && (
                                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                                      <span className="font-medium text-foreground/80">Notes/Ref:</span> {exp.notes}
                                    </p>
                                  )}
                                  {(exp.receipt_path || receipts?.length) && (
                                    <div className="text-[11px] text-primary space-y-0.5">
                                      <span className="font-medium text-foreground/80">Receipts:</span>{' '}
                                      {receipts?.length ? (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                          {receipts.map((r: any, idx: number) => {
                                            const p = typeof r === 'string' ? r : r?.url || r?.path || r?.file_path;
                                            const href = getFileUrl(p);
                                            const label = typeof r === 'string' ? `Receipt ${idx + 1}` : r?.name || r?.original_name || `Receipt ${idx + 1}`;
                                            const openPath = r?.id ? `/expenses/${exp.id}/attachments/${r.id}` : (p || `/expenses/${exp.id}/receipt`);
                                            return href || r?.id ? (
                                              <button
                                                key={idx}
                                                type="button"
                                                onClick={() => openProtectedFile(openPath).catch((e) => toast.error(e?.message || 'Unable to open receipt'))}
                                                className="underline hover:text-primary/80"
                                              >
                                                {label}
                                              </button>
                                            ) : (
                                              <span key={idx} className="text-muted-foreground">{label}</span>
                                            );
                                          })}
                                        </div>
                                      ) : getFileUrl(exp.receipt_path) ? (
                                        <button
                                          type="button"
                                          onClick={() => openProtectedFile(`/expenses/${exp.id}/receipt`).catch((e) => toast.error(e?.message || 'Unable to open receipt'))}
                                          className="underline hover:text-primary/80 ml-1"
                                        >
                                          Open receipt
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground ml-1">attached</span>
                                      )}
                                    </div>
                                  )}
                                  {exp.fuel_analysis?.is_anomaly && (
                                    <div className="flex items-start gap-1 text-[11px] font-semibold text-destructive">
                                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                      <span>
                                        Fuel anomaly: {exp.fuel_analysis.km_per_litre} km/L ({exp.fuel_analysis.deviation_pct}% dev)
                                        {exp.fuel_analysis.reason ? `   ${exp.fuel_analysis.reason}` : ''}
                                      </span>
                                    </div>
                                  )}
                                  {exp.rejection_reason && (
                                    <p className="text-[11px] text-destructive">
                                      <span className="font-semibold">Rejection reason:</span> {exp.rejection_reason}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold align-top">
                                <MoneyText amount={exp.amount} size="base" />
                              </td>
                              <td className="py-3 px-4 text-center align-top">
                                <StatusBadge status={exp.status} />
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => setEditingExpense(exp)}
                                    title="Edit expense details"
                                  >
                                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  {exp.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs text-success border-success/30 hover:bg-success-bg"
                                        onClick={() => expenseStatusMutation.mutate({ expenseId: exp.id, status: 'approved' })}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive-bg"
                                        onClick={() => {
                                          const reason = window.prompt('Reason for rejecting this expense (required):', '');
                                          if (reason && reason.trim()) {
                                            expenseStatusMutation.mutate({ expenseId: exp.id, status: 'rejected', reason: reason.trim() });
                                          } else if (reason !== null) {
                                            toast.error('Rejection reason is required');
                                          }
                                        }}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setExpenseToReassign(exp);
                                      setReassignModalOpen(true);
                                    }}
                                    title="Reassign to another trip"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Reassign
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1 Col: Trip P&L Card & Driver Advance Settlement */}
        <div className="space-y-6">
          {/* Official Trip P&L Card */}
          <Card className="border-primary/30">
            <CardHeader className="bg-primary/5 pb-3 border-b border-border">
              <CardTitle className="text-base text-primary flex items-center justify-between">
                <span>Trip Financial P&L</span>
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary text-white">
                  Contribution
                </span>
              </CardTitle>
              <CardDescription>
                Live revenue vs approved direct expense reconciliation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Agreed Rate */}
              <div className="flex items-center justify-between py-2 border-b border-border/60">
                <span className="text-muted-foreground font-medium">Agreed Revenue Rate</span>
                <MoneyText amount={pnl?.revenue ?? trip.agreed_rate} size="lg" />
              </div>

              {/* Direct Expenses Breakdown */}
              <div className="space-y-2 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Approved Direct Expenses
                </span>
                {pnl?.breakdown_by_category && (() => {
                  const entries = Object.entries(pnl.breakdown_by_category)
                    .filter(([, amt]) => Number(amt) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]));
                  if (!entries.length) {
                    return <p className="text-muted-foreground text-[11px]">No approved direct expenses yet.</p>;
                  }
                  return (
                    <div className="max-h-36 overflow-y-auto overscroll-contain pr-1 space-y-1.5 rounded-md border border-border/50 bg-background/40 p-2">
                      {entries.map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between text-muted-foreground gap-3 text-[11px] shrink-0">
                          <span className="capitalize truncate">{cat.replace(/_/g, ' ')}</span>
                          <MoneyText amount={amt} size="sm" />
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex justify-between font-semibold text-destructive pt-2 border-t border-border/40">
                  <span>Total Direct Costs</span>
                  <MoneyText amount={pnl?.approved_direct_costs ?? 0} variant="negative" size="base" />
                </div>
              </div>
              {/* Contribution Highlight Box */}
              <div className="p-4 rounded-xl bg-success-bg/80 border border-success/30 text-success-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider">Trip Contribution</span>
                  <span className="font-mono text-xl font-bold">
                    {formatKES(pnl?.contribution ?? trip.contribution)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-success font-medium">
                  <span>Contribution Margin</span>
                  <span>{pnl?.contribution_margin_pct ?? 0}%</span>
                </div>
              </div>

              {/* Mandatory East African Transporter Disclaimer */}
              <div className="p-3 rounded-lg bg-secondary/80 border border-border text-[11px] text-muted-foreground leading-relaxed">
                <strong>Accounting Note:</strong> Contribution reflects revenue minus approved direct haulage costs. Shared fleet overheads (insurance, yard rent, finance interest) are excluded.
              </div>
            </CardContent>
          </Card>

          {/* Driver Advance Settlement Panel */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Driver Advance Trail</span>
                {trip.advances && trip.advances[0] && (
                  <StatusBadge status={trip.advances[0].status} />
                )}
              </CardTitle>
              <CardDescription>
                Settlement trail: advance given â†’ accepted expenses â†’ returned balance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 text-xs space-y-3">
              {trip.advances && trip.advances.length > 0 ? (
                trip.advances.map((adv) => (
                  <div key={adv.id} className="space-y-3">
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">1. Cash Advance Given</span>
                      <MoneyText amount={adv.amount_given} size="base" />
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">2. Expenses Accepted</span>
                      <MoneyText amount={adv.expenses_accepted} size="base" />
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">3. Cash Returned</span>
                      <MoneyText amount={adv.amount_returned} size="base" />
                    </div>
                    <div className="flex justify-between py-2 font-bold text-foreground">
                      <span>Unsettled Balance Due</span>
                      <MoneyText
                        amount={adv.balance_remaining}
                        variant={adv.balance_remaining > 0 ? 'negative' : 'positive'}
                        size="base"
                      />
                    </div>

                    {/* Advance Adjustments Trail (if any) */}
                    {adv.adjustments && adv.adjustments.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-secondary/60 border border-border space-y-1.5 my-2">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider block">
                          Adjustment Trail
                        </span>
                        {adv.adjustments.map((adj) => (
                          <div key={adj.id} className="text-[11px] flex justify-between items-start border-t border-border/40 pt-1">
                            <div>
                              <span className="font-semibold text-foreground">{adj.type === 'additional_advance' ? '+ KES ' : '- KES '}{adj.amount.toLocaleString()}</span>
                              <p className="text-[10px] text-muted-foreground">{adj.reason}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{adj.created_at?.slice(0, 10)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {adv.status === 'open' && (
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          setSelectedAdvance(adv);
                          setReturnedAmount(adv.balance_remaining > 0 ? adv.balance_remaining : 0);
                          setSettleModalOpen(true);
                        }}
                      >
                        Reconcile & Settle Advance
                      </Button>
                    )}

                    {adv.status === 'settled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => setAdjustingAdvance(adv)}
                      >
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                        Post Advance Adjustment
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  No advance issued for this trip.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Expense Sheet / Drawer */}
      <Sheet open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record Trip Expense</SheetTitle>
            <SheetDescription>
              Submit an operational expense for {trip.reference}.
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit(
              (d) => expenseMutation.mutate(d),
              (errors) => {
                console.error('Validation errors on expense submission:', errors);
                const firstErr = Object.values(errors)[0];
                toast.error(firstErr?.message ? String(firstErr.message) : 'Please check expense form fields');
              }
            )}
            className="space-y-4 py-4"
          >
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Expense Category</label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <CategorySelect
                    value={field.value}
                    onChange={field.onChange}
                    suggestions={(trip.expenses || []).map((e) => e.category)}
                  />
                )}
              />
              {expenseErrors.category && (
                <p className="text-[11px] text-destructive mt-1">{expenseErrors.category.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Amount (KES)</label>
              <Input
                type="number"
                step="10"
                placeholder="Enter amount"
                {...register('amount', {
                  setValueAs: (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v)),
                })}
              />
              {expenseErrors.amount && (
                <p className="text-[11px] text-destructive mt-1">{expenseErrors.amount.message}</p>
              )}
            </div>

            {/* Dynamic fuel fields */}
            {watchCategory === 'fuel' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Litres Filled (Optional)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 150"
                    {...register('litres', {
                      setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
                    })}
                  />
                  {expenseErrors.litres && (
                    <p className="text-[11px] text-destructive mt-1">{expenseErrors.litres.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Odometer at Pump (Optional)</label>
                  <Input
                    type="number"
                    placeholder="KM reading"
                    {...register('odometer_at_fill', {
                      setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
                    })}
                  />
                  {expenseErrors.odometer_at_fill && (
                    <p className="text-[11px] text-destructive mt-1">{expenseErrors.odometer_at_fill.message}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Date &amp; Time Incurred</label>
              <Input type="datetime-local" {...register('incurred_at')} placeholder="" />
              {expenseErrors.incurred_at && (
                <p className="text-[11px] text-destructive mt-1">{expenseErrors.incurred_at.message}</p>
              )}
            </div>

            {/* Receipt/Document Uploads */}
            <FileUpload onFilesSelect={setSelectedReceipts} label="Attach Receipts or Documents (multiple allowed)" />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Notes / Receipt Number</label>
              <Input placeholder="Receipt ref, vendor, location..." {...register('notes')} />
            </div>

            <SheetFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddExpenseOpen(false)}
                disabled={expenseMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={expenseMutation.isPending}>
                {expenseMutation.isPending ? 'Submitting...' : 'Save Expense'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Reassign Expense Modal (with audit reason requirement) */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Expense to Another Trip</DialogTitle>
            <DialogDescription>
              Correct misassigned costs. This action is permanently recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-secondary text-xs">
              <p className="font-semibold text-foreground capitalize">
                Expense: {expenseToReassign?.category.replace(/_/g, ' ')}
              </p>
              <p className="text-muted-foreground">
                Amount: <span className="font-mono font-bold text-foreground">{formatKES(expenseToReassign?.amount)}</span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Target Trip Destination
              </label>
              <select
                value={targetTripId}
                onChange={(e) => setTargetTripId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="">-- Select target trip --</option>
                {allTripsData?.data
                  ?.filter((t) => t.id !== Number(tripId))
                  ?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.reference} â€” {t.origin} to {t.destination} ({t.truck?.reg_number})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Reason for Reassignment (Mandatory Audit Log)
              </label>
              <Input
                placeholder="e.g. Incurred on Malaba route, mistakenly tagged to Mombasa trip."
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!targetTripId || reassignReason.trim().length < 5 || reassignMutation.isPending}
              onClick={() => {
                if (expenseToReassign) {
                  reassignMutation.mutate({
                    expenseId: expenseToReassign.id,
                    targetTripId: Number(targetTripId),
                    reason: reassignReason,
                  });
                }
              }}
            >
              {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Delivered Modal */}
      <Dialog open={deliveredModalOpen} onOpenChange={setDeliveredModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Trip Delivery</DialogTitle>
            <DialogDescription>
              Record the closing odometer reading to finalize distance and return truck to available status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Closing Odometer (KM)
              </label>
              <Input
                type="number"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value ? Number(e.target.value) : '')}
                placeholder={`Must be >= start odometer (${trip.start_odometer})`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Starting odometer was {formatKm(trip.start_odometer)}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveredModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!endOdometer || Number(endOdometer) < trip.start_odometer || tripStatusMutation.isPending}
              onClick={() => {
                tripStatusMutation.mutate({
                  status: 'delivered',
                  end_odometer: Number(endOdometer),
                  end_date: new Date().toISOString().split('T')[0],
                });
              }}
            >
              {tripStatusMutation.isPending ? 'Saving...' : 'Mark as Delivered'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Driver Advance Modal */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Driver Advance</DialogTitle>
            <DialogDescription>
              Record the remaining cash returned by the driver.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg bg-secondary border border-border space-y-1">
              <p className="text-muted-foreground">
                Advance Given: <span className="font-mono font-bold text-foreground">{formatKES(selectedAdvance?.amount_given)}</span>
              </p>
              <p className="text-muted-foreground">
                Expenses Accepted: <span className="font-mono font-semibold text-success">{formatKES(selectedAdvance?.expenses_accepted)}</span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Amount Returned by Driver (KES)
              </label>
              <Input
                type="number"
                step="10"
                value={returnedAmount}
                onChange={(e) => setReturnedAmount(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={settleAdvanceMutation.isPending}
              onClick={() => {
                if (selectedAdvance) {
                  settleAdvanceMutation.mutate({
                    advanceId: selectedAdvance.id,
                    returned: Number(returnedAmount || 0),
                  });
                }
              }}
            >
              {settleAdvanceMutation.isPending ? 'Settling...' : 'Confirm Settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safe Editing Sheet and Dialogs */}
      <EditTripSheet
        trip={trip}
        trucks={trucksData?.data ?? []}
        activeTrips={activeTripsData?.data ?? []}
        drivers={driversData?.data ?? []}
        customers={customersData?.data ?? []}
        open={editTripSheetOpen}
        onOpenChange={setEditTripSheetOpen}
      />

      <EditExpenseDialog
        expense={editingExpense}
        open={!!editingExpense}
        onOpenChange={(open) => {
          if (!open) setEditingExpense(null);
        }}
      />

      <AdvanceAdjustmentDialog
        advance={adjustingAdvance}
        open={!!adjustingAdvance}
        onOpenChange={(open) => {
          if (!open) setAdjustingAdvance(null);
        }}
      />
    </div>
  );
}


