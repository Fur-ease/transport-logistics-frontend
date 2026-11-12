import type { Trip, Truck } from '@/types';

export interface TruckOption {
  truck: Truck;
  disabled: boolean;
  reason: string | null;
  note: string | null;
  rank: number;
}

function overlaps(trip: Trip, startDate: string, endDate: string): boolean {
  const tripStart = trip.start_date?.slice(0, 10);
  if (!tripStart) return false;

  const tripEnd = trip.end_date?.slice(0, 10) ?? null;

  return tripStart <= endDate && (!tripEnd || tripEnd >= startDate);
}

/**
 * Builds the truck picker list: available trucks first, then trucks that are
 * on a trip but free for the selected dates, then hard-blocked trucks.
 * The truck already assigned to the trip being edited is always selectable.
 */
export function buildTruckOptions(
  trucks: Truck[],
  activeTrips: Trip[],
  startDate?: string | null,
  endDate?: string | null,
  currentTruckId?: number | null
): TruckOption[] {
  const start = startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const end = endDate?.slice(0, 10) || start;

  return trucks
    .map((truck) => {
      const isCurrent = currentTruckId != null && truck.id === currentTruckId;
      const conflict = activeTrips.find(
        (trip) => trip.truck_id === truck.id && overlaps(trip, start, end)
      );

      let disabled = false;
      let reason: string | null = null;
      let note: string | null = null;

      if (truck.status === 'maintenance') {
        disabled = true;
        reason = 'In maintenance';
      } else if (truck.status === 'inactive') {
        disabled = true;
        reason = 'Inactive';
      } else if (conflict) {
        disabled = true;
        reason = `On trip ${conflict.reference}${
          conflict.end_date ? ` until ${conflict.end_date.slice(0, 10)}` : ''
        }`;
      } else if (truck.status === 'on_trip') {
        note = 'On trip — free for selected dates';
      }

      if (isCurrent) {
        disabled = false;
        reason = null;
        note = 'Currently assigned to this trip';
      }

      return {
        truck,
        disabled,
        reason,
        note,
        rank: disabled ? 2 : note ? 1 : 0,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.truck.reg_number.localeCompare(b.truck.reg_number));
}
