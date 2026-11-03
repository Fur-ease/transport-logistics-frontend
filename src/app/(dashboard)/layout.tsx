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
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isLoading, router, pathname]);

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
        <Topbar />
        <main className="flex-1 pb-20 md:pb-10 pt-6 px-4 sm:px-6 md:px-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
        <MobileBottomNav />
      </div>
      <CommandPalette />
    </div>
  );
}

