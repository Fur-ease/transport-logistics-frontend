import type { QueryClient } from '@tanstack/react-query';

export const LIVE_REFETCH_MS = 15000;

/**
 * Money touches many records: trips, expenses, advances, invoices, payments,
 * trucks, reports and the dashboard. Invalidating every query guarantees every
 * visible page recalculates immediately after any financial mutation.
 */
export function syncFinancialState(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
}
