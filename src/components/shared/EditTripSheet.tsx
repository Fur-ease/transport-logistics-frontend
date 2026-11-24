'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Unlock, AlertCircle, ArrowRight, Save, Truck as TruckIcon, ShieldCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { syncFinancialState } from '@/lib/liveSync';
import { buildTruckOptions } from '@/lib/truckAvailability';
import { Trip, Truck, Driver, Customer } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatKES } from '@/lib/formatters';
import { ConcurrencyModal } from './ConcurrencyModal';

const tripEditSchema = z.object({
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
  cargo_description: z.string().min(2, 'Cargo description required'),
  cargo_weight_tons: z.number().min(0.1, 'Weight must be > 0'),
  agreed_rate: z.number().min(0, 'Rate must be >= 0'),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional().nullable(),
  start_odometer: z.number().min(0, 'Start odometer must be >= 0'),
  end_odometer: z.number().optional().nullable(),
  truck_id: z.number().min(1, 'Select a truck'),
  trailer_id: z.number().nullable().optional(),
  driver_id: z.number().min(1, 'Select a driver'),
  customer_id: z.number().min(1, 'Select a customer'),
  notes: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

type TripEditFormData = z.infer<typeof tripEditSchema>;

interface EditTripSheetProps {
  trip: Trip;
  trucks: Truck[];
  activeTrips?: Trip[];
  drivers: Driver[];
  customers: Customer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditTripSheet({
  trip,
  trucks,
  activeTrips = [],
  drivers,
  customers,
  open,
  onOpenChange,
  onSuccess,
}: EditTripSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [concurrencyError, setConcurrencyError] = useState<{
    open: boolean;
    currentVersion?: number;
    conflictFields?: string[];
  }>({ open: false });

  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const isRateLocked = trip.is_rate_locked || ['invoiced', 'paid'].includes(trip.status);
  const isSensitiveStatus = ['delivered', 'invoiced', 'paid'].includes(trip.status);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TripEditFormData>({
    resolver: zodResolver(tripEditSchema),
    defaultValues: {
      origin: trip.origin,
      destination: trip.destination,
      cargo_description: trip.cargo_description,
      cargo_weight_tons: Number(trip.cargo_weight_tons),
      agreed_rate: Number(trip.agreed_rate),
      start_date: trip.start_date?.slice(0, 10) || '',
      end_date: trip.end_date?.slice(0, 10) || '',
      start_odometer: trip.start_odometer,
      end_odometer: trip.end_odometer ?? null,
      truck_id: trip.truck_id,
      trailer_id: trip.trailer_id ?? null,
      driver_id: trip.driver_id,
      customer_id: trip.customer_id,
      notes: trip.notes || '',
      reason: '',
    },
  });

  const watchedValues = watch();
  const watchedTruckId = watchedValues.truck_id;
  const truckOptions = buildTruckOptions(
    trucks,
    activeTrips,
    watchedValues.start_date,
    watchedValues.end_date,
    trip.truck_id
  );
  const selectedTruckOption = truckOptions.find(
    (option) => option.truck.id === Number(watchedTruckId)
  );

  React.useEffect(() => {
    if (Number(watchedTruckId) === trip.truck_id) return;
    const selected = trucks.find((t) => t.id === Number(watchedTruckId));
    if (!selected) return;
    setValue('trailer_id', selected.current_assignment?.trailer_id ?? null);
  }, [watchedTruckId, trucks, setValue, trip.truck_id]);

  const updateMutation = useMutation({
    mutationFn: async (data: TripEditFormData) => {
      return api.put(`/trips/${trip.id}`, {
        ...data,
        version: trip.version ?? 1,
      });
    },
    onSuccess: async () => {
      toast.success(`Trip ${trip.reference} updated successfully`);
      await syncFinancialState(queryClient);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      if (err?.error_code === 'CONCURRENCY_CONFLICT' || err?.status === 409) {
        setConcurrencyError({
          open: true,
          currentVersion: err.current_version,
          conflictFields: err.conflict_fields,
        });
      } else {
        toast.error(err?.message || 'Failed to update trip.');
      }
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/trips/${trip.id}/unlock`, {
        reason: unlockReason,
        duration_minutes: 60,
      });
    },
    onSuccess: async (data: any) => {
      toast.success(data?.message || 'Trip unlocked for editing');
      await syncFinancialState(queryClient);
      setShowUnlockModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to unlock trip');
    },
  });

  const onSubmit = (data: TripEditFormData) => {
    // If rate is locked, retain original agreed_rate
    if (isRateLocked) {
      data.agreed_rate = Number(trip.agreed_rate);
    }

    // Reason validation for delivered/invoiced trips or reassignments
    const hasReassigned =
      Number(data.truck_id) !== trip.truck_id ||
      Number(data.driver_id) !== trip.driver_id;

    if ((isSensitiveStatus || hasReassigned) && (!data.reason || data.reason.trim().length < 3)) {
      toast.error('A clear reason is required when modifying a delivered or reassigned trip.');
      return;
    }

    updateMutation.mutate(data);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[92vh] sm:max-h-none overflow-y-auto p-4 sm:p-6">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base font-bold font-mono">
                  Edit Trip: {trip.reference}
                </SheetTitle>
              </div>
              <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-secondary text-foreground">
                v{trip.version ?? 1}
              </span>
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Safely modify route, driver assignment, cargo, or odometers. All changes are logged to the audit timeline.
            </SheetDescription>
          </SheetHeader>

          {/* Locked Notice & Unlock Action for Owner */}
          {isRateLocked && (
            <div className="my-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Billed Financial Fields Locked
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                    This trip is in <strong>{trip.status}</strong> status. The agreed haulage rate cannot be changed directly. Use a Credit Note on the linked invoice.
                  </p>
                </div>
              </div>

              {user?.role === 'owner' && !trip.has_active_unlock && (
                <div className="pt-2 border-t border-amber-500/20 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 text-xs"
                    onClick={() => setShowUnlockModal(true)}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                    Owner Unlock (60 Mins)
                  </Button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Origin *</label>
                <Input {...register('origin')} />
                {errors.origin && <p className="text-[11px] text-destructive mt-1">{errors.origin.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Destination *</label>
                <Input {...register('destination')} />
                {errors.destination && <p className="text-[11px] text-destructive mt-1">{errors.destination.message}</p>}
              </div>
            </div>

            {/* Assignments: Truck & Driver */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Truck Assignment *</label>
                <select
                  {...register('truck_id', { valueAsNumber: true })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-input bg-card text-foreground"
                >
                  {truckOptions.map(({ truck: t, disabled, reason, note }) => (
                    <option key={t.id} value={t.id} disabled={disabled}>
                      {t.reg_number} - {t.make} {t.model}
                      {disabled ? ` (${reason})` : note ? ` (${note})` : ` (${t.status})`}
                    </option>
                  ))}
                </select>
                {errors.truck_id && <p className="text-[11px] text-destructive mt-1">{errors.truck_id.message}</p>}
                {selectedTruckOption?.disabled && (
                  <p className="text-[11px] text-destructive mt-1">
                    {selectedTruckOption.reason}. Pick another truck or adjust the dates.
                  </p>
                )}
                {(() => {
                  const selected = trucks.find((t) => t.id === Number(watchedTruckId));
                  if (!selected) return null;
                  const trailer =
                    Number(watchedTruckId) === trip.truck_id
                      ? trip.trailer
                      : selected.current_assignment?.trailer;
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {trailer
                        ? `Trip trailer: ${trailer.reg_number}`
                        : 'This head has no coupled trailer; trip will be head-only.'}
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Driver Assignment *</label>
                <select
                  {...register('driver_id', { valueAsNumber: true })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-input bg-card text-foreground"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
                {errors.driver_id && <p className="text-[11px] text-destructive mt-1">{errors.driver_id.message}</p>}
              </div>
            </div>

            {/* Customer & Agreed Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Customer *</label>
                <select
                  {...register('customer_id', { valueAsNumber: true })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-input bg-card text-foreground"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">Agreed Rate (KES) *</label>
                  {isRateLocked && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  step="100"
                  disabled={isRateLocked}
                  className={isRateLocked ? 'bg-muted cursor-not-allowed' : ''}
                  {...register('agreed_rate', { valueAsNumber: true })}
                />
                {errors.agreed_rate && <p className="text-[11px] text-destructive mt-1">{errors.agreed_rate.message}</p>}
              </div>
            </div>

            {/* Cargo Description & Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">Cargo Description *</label>
                <Input {...register('cargo_description')} />
                {errors.cargo_description && <p className="text-[11px] text-destructive mt-1">{errors.cargo_description.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Weight (Tons) *</label>
                <Input type="number" step="0.1" {...register('cargo_weight_tons', { valueAsNumber: true })} />
              </div>
            </div>

            {/* Dates & Odometers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Start Date *</label>
                <Input type="date" {...register('start_date')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">End Date</label>
                <Input type="date" {...register('end_date')} />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Start Odometer (KM) *</label>
                <Input type="number" {...register('start_odometer', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">End Odometer (KM)</label>
                <Input type="number" {...register('end_odometer', { valueAsNumber: true })} />
              </div>
            </div>

            {/* Operational Notes */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Trip Notes</label>
              <Input {...register('notes')} placeholder="Optional instructions or dispatch details" />
            </div>

            {/* Edit Reason (Required for delivered/invoiced or reassignments) */}
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
              <label className="text-xs font-semibold text-primary block flex items-center justify-between">
                <span>Reason for Edit {isSensitiveStatus && '*'}</span>
                <span className="text-[10px] text-muted-foreground font-normal">Audit Trail Record</span>
              </label>
              <Input
                {...register('reason')}
                placeholder="e.g. Corrected offloading odometer or driver re-route"
                className="bg-card"
              />
              <p className="text-[11px] text-muted-foreground">
                This reason will be attached to your user ID and recorded in the audit log.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="font-semibold">
                {updateMutation.isPending ? 'Saving...' : 'Save Trip Changes'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Owner Unlock Dialog */}
      <Sheet open={showUnlockModal} onOpenChange={setShowUnlockModal}>
        <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-2xl p-6">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base font-bold">Owner Override: Unlock Trip</SheetTitle>
            </div>
            <SheetDescription className="text-xs">
              Grant a temporary 60-minute unlock window for this billed trip. All edits during this lease will be recorded in audit logs.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Reason for unlocking billed trip *
              </label>
              <Input
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Correcting customer reference as requested by audit"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUnlockModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={!unlockReason.trim() || unlockMutation.isPending}
                onClick={() => unlockMutation.mutate()}
              >
                {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Concurrency Conflict Modal */}
      <ConcurrencyModal
        open={concurrencyError.open}
        onClose={() => setConcurrencyError({ open: false })}
        serverVersion={concurrencyError.currentVersion}
        conflictFields={concurrencyError.conflictFields}
        onRefresh={async () => {
          await syncFinancialState(queryClient);
          onOpenChange(false);
        }}
      />
    </>
  );
}

