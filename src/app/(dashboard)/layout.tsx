'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useAuth } from '@/components/providers/AuthProvider';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isSuperAdmin, impersonatedOrg, exitOrganization } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    } else if (!isLoading && user && isSuperAdmin && !impersonatedOrg) {
      router.push('/super-admin');
    }
  }, [user, isLoading, isSuperAdmin, impersonatedOrg, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
        <div className="space-y-4 w-full max-w-md text-center">
          <div className="h-10 w-10 mx-auto rounded-xl bg-primary flex items-center justify-center text-white font-bold animate-pulse">
            H
          </div>
          <p className="text-sm font-medium text-foreground">Loading HaulTrack workspace...</p>
          <Skeleton className="h-2 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {isSuperAdmin && impersonatedOrg && (
          <div className="bg-emerald-700 text-white px-4 py-2 text-xs sm:text-sm flex items-center justify-between gap-3">
            <span className="font-medium truncate">
              Platform Admin Mode — Viewing <strong>{impersonatedOrg.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                exitOrganization();
                router.push('/super-admin');
              }}
              className="shrink-0 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition-colors"
            >
              Exit to Control Center
            </button>
          </div>
        )}
        <Topbar />
        <main className="flex-1 pb-20 md:pb-10 pt-4 sm:pt-6 px-3 sm:px-6 md:px-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
        <MobileBottomNav />
      </div>
      <CommandPalette />
    </div>
  );
}

