'use client';
import { syncFinancialState } from '@/lib/liveSync';

import React, { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, Unlink, Container } from 'lucide-react';
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
import { Trailer, Truck } from '@/types';
import { formatKm } from '@/lib/formatters';

const optionalNumber = z.preprocess(
  (value) =>
    value === '' || value === undefined || value === null || Number.isNaN(Number(value))
      ? null
      : Number(value),
  z.number().min(0, 'Enter a valid odometer reading').nullable()
) as z.ZodType<number | null>;

const coupleSchema = z.object({
  trailer_id: z.number().min(1, 'Select an available trailer'),
  coupled_at: z.string().min(1, 'Coupling date is required'),
  odometer_at_couple: optionalNumber,
  couple_notes: z.string().max(500).optional().nullable(),
});

const uncoupleSchema = z.object({
  reason: z.string().min(3, 'A reason is required (at least 3 characters)').max(500),
  uncoupled_at: z.string().min(1, 'Uncoupling date is required'),
  odometer_at_uncouple: optionalNumber,
});

type CoupleFormData = z.infer<typeof coupleSchema>;
type UncoupleFormData = z.infer<typeof uncoupleSchema>;

interface CouplingDialogProps {
  mode: 'couple' | 'uncouple';
  truck: Truck | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CouplingDialog({ mode, truck, open, onOpenChange }: CouplingDialogProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: trailersData, isLoading: isTrailersLoading } = useQuery<{ data: Trailer[] }>({
    queryKey: ['trailers', 'available'],
    queryFn: () => api.get<{ data: Trailer[] }>('/trailers', { status: 'available', per_page: 100 }),
    enabled: open && mode === 'couple',
  });

  const coupleForm = useForm<CoupleFormData>({
    resolver: zodResolver(coupleSchema) as unknown as Resolver<CoupleFormData>,
    defaultValues: {
      coupled_at: today,
      odometer_at_couple: null,
      couple_notes: '',
    },
  });

  const uncoupleForm = useForm<UncoupleFormData>({
    resolver: zodResolver(uncoupleSchema) as unknown as Resolver<UncoupleFormData>,
    defaultValues: {
      reason: '',
      uncoupled_at: today,
      odometer_at_uncouple: null,
    },
  });

  useEffect(() => {
    if (!open || !truck) return;

    if (mode === 'couple') {
      coupleForm.reset({
        coupled_at: today,
        odometer_at_couple: truck.odometer_km,
        couple_notes: '',
        trailer_id: undefined as unknown as number,
      });
    } else {
      uncoupleForm.reset({
        reason: '',
        uncoupled_at: today,
        odometer_at_uncouple: truck.odometer_km,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, truck?.id]);

  const invalidate = async () => {
    if (!truck) return;
    await syncFinancialState(queryClient);
  };

  const coupleMutation = useMutation({
    mutationFn: (data: CoupleFormData) => api.post(`/trucks/${truck?.id}/couple`, data),
    onSuccess: async (response: unknown) => {
      const message =
        response && typeof response === 'object' && 'message' in response
          ? String((response as { message: string }).message)
          : 'Trailer coupled successfully';
      await invalidate();
      toast.success(message);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to couple trailer'),
  });

  const uncoupleMutation = useMutation({
    mutationFn: (data: UncoupleFormData) => api.post(`/trucks/${truck?.id}/uncouple`, data),
    onSuccess: async (response: unknown) => {
      const message =
        response && typeof response === 'object' && 'message' in response
          ? String((response as { message: string }).message)
          : 'Trailer uncoupled successfully';
      await invalidate();
      toast.success(message);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to uncouple trailer'),
  });

  const currentTrailer = truck?.current_assignment?.trailer;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode === 'couple' ? (
              <Link2 className="h-5 w-5 text-primary" />
            ) : (
              <Unlink className="h-5 w-5 text-destructive" />
            )}
            {mode === 'couple' ? 'Couple Trailer' : 'Uncouple Trailer'}
          </SheetTitle>
          <SheetDescription>
            {truck ? (
              <>
                Truck head <span className="font-mono font-semibold text-foreground">{truck.reg_number}</span>
                {mode === 'uncouple' && currentTrailer
                  ? ` — currently pulling ${currentTrailer.reg_number}`
                  : ''}
              </>
            ) : (
              'Select a truck head to manage its coupling.'
            )}
          </SheetDescription>
        </SheetHeader>

        {mode === 'couple' ? (
          <form
            onSubmit={coupleForm.handleSubmit((data) => coupleMutation.mutate(data))}
            className="space-y-4 py-4"
          >
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Available Trailer *
              </label>
              <select
                {...coupleForm.register('trailer_id', { valueAsNumber: true })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                disabled={isTrailersLoading}
              >
                <option value="">{isTrailersLoading ? 'Loading trailers...' : '-- Select trailer --'}</option>
                {trailersData?.data?.map((trailer) => (
                  <option key={trailer.id} value={trailer.id}>
                    {trailer.reg_number} — {trailer.type.replace('_', ' ')} ({trailer.capacity_tons}t)
                  </option>
                ))}
              </select>
              {coupleForm.formState.errors.trailer_id && (
                <p className="text-[11px] text-destructive mt-1">
                  {coupleForm.formState.errors.trailer_id.message}
                </p>
              )}
              {!isTrailersLoading && (trailersData?.data?.length ?? 0) === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  No available trailers. Register a trailer first or uncouple one in use.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Coupled On *</label>
                <Input type="date" {...coupleForm.register('coupled_at')} />
                {coupleForm.formState.errors.coupled_at && (
                  <p className="text-[11px] text-destructive mt-1">
                    {coupleForm.formState.errors.coupled_at.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Odometer (KM)
                </label>
                <Input type="number" {...coupleForm.register('odometer_at_couple')} />
                {coupleForm.formState.errors.odometer_at_couple && (
                  <p className="text-[11px] text-destructive mt-1">
                    {coupleForm.formState.errors.odometer_at_couple.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Notes</label>
              <Input
                placeholder="e.g. Trailer collected from Nairobi yard"
                {...coupleForm.register('couple_notes')}
              />
            </div>

            {currentTrailer && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning-bg text-xs text-warning-foreground">
                This head is already coupled to{' '}
                <span className="font-mono font-bold">{currentTrailer.reg_number}</span>. Uncouple it
                before coupling a different trailer.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={coupleMutation.isPending || !!currentTrailer}
                className="font-semibold"
              >
                {coupleMutation.isPending ? 'Coupling...' : 'Couple Trailer'}
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={uncoupleForm.handleSubmit((data) => uncoupleMutation.mutate(data))}
            className="space-y-4 py-4"
          >
            <div className="p-3 rounded-xl border border-border bg-secondary/50 flex items-center gap-3">
              <Container className="h-8 w-8 text-primary" />
              <div className="text-xs">
                <p className="font-mono font-bold text-sm text-foreground">
                  {currentTrailer?.reg_number ?? 'No trailer coupled'}
                </p>
                <p className="text-muted-foreground">
                  {currentTrailer
                    ? `${currentTrailer.type.replace('_', ' ')} • ${currentTrailer.capacity_tons} tons`
                    : 'This truck head has no active coupling.'}
                </p>
                {truck?.current_assignment && (
                  <p className="text-muted-foreground mt-0.5">
                    Coupled {new Date(truck.current_assignment.coupled_at).toLocaleDateString()} at{' '}
                    {formatKm(truck.current_assignment.odometer_at_couple ?? 0)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Reason for Uncoupling *
              </label>
              <Input
                placeholder="e.g. Trailer due for service, swapping to tanker"
                {...uncoupleForm.register('reason')}
              />
              {uncoupleForm.formState.errors.reason && (
                <p className="text-[11px] text-destructive mt-1">
                  {uncoupleForm.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Uncoupled On *
                </label>
                <Input type="date" {...uncoupleForm.register('uncoupled_at')} />
                {uncoupleForm.formState.errors.uncoupled_at && (
                  <p className="text-[11px] text-destructive mt-1">
                    {uncoupleForm.formState.errors.uncoupled_at.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Odometer (KM)
                </label>
                <Input type="number" {...uncoupleForm.register('odometer_at_uncouple')} />
                {uncoupleForm.formState.errors.odometer_at_uncouple && (
                  <p className="text-[11px] text-destructive mt-1">
                    {uncoupleForm.formState.errors.odometer_at_uncouple.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={uncoupleMutation.isPending || !currentTrailer}
                className="font-semibold"
              >
                {uncoupleMutation.isPending ? 'Uncoupling...' : 'Confirm Uncouple'}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
