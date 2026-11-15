import type { QueryClient } from '@tanstack/react-query';

export const LIVE_REFETCH_MS = 15000;

/**
 * Global real-time sync: ensure UI reflects mutations instantly when success is shown.
 * Invalidates all queries and force-refetches active ones so dashboard/cards update immediately.
 */
export async function syncFinancialState(queryClient: QueryClient) {
  await queryClient.invalidateQueries();
  await queryClient.refetchQueries({ type: 'active' });
}