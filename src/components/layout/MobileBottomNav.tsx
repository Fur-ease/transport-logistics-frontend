'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Truck, Menu, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isDriver } = useAuth();

  const links = isDriver
    ? [
        { label: 'My Trips', href: '/driver', icon: Receipt },
        { label: 'All Trips', href: '/trips', icon: MapPin },
        { label: 'Trucks', href: '/trucks', icon: Truck },
        { label: 'Settings', href: '/settings', icon: Menu },
      ]
    : [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Trips', href: '/trips', icon: MapPin },
        { label: 'Trucks', href: '/trucks', icon: Truck },
        { label: 'Driver View', href: '/driver', icon: Receipt },
        { label: 'More', href: '/settings', icon: Menu },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 glass-surface border-t border-border flex items-center justify-around px-2">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-lg transition-colors select-none',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
            <span className="text-[10px] mt-1 tracking-tight">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

