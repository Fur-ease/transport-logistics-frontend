'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from './AuthProvider';
import { LIVE_REFETCH_MS } from '@/lib/liveSync';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 1000 * 60 * 5,
            refetchInterval: LIVE_REFETCH_MS,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: 'always',
            placeholderData: (previousData: unknown) => previousData,
            retry: 1,
          },
        },
      })
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}