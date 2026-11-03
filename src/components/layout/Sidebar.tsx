'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  MapPin,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  driverOnly?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isDriver } = useAuth();

  const navGroups: NavGroup[] = [
    {
      group: 'Operations',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Trips & Dispatch', href: '/trips', icon: MapPin },
        { label: 'Driver Portal', href: '/driver', icon: Receipt },
      ],
    },
    {
      group: 'Fleet',
      items: [
        { label: 'Trucks', href: '/trucks', icon: Truck },
        { label: 'Drivers', href: '/drivers', icon: Users },
      ],
    },
    {
      group: 'Finance',
      items: [
        { label: 'Customers', href: '/customers', icon: Building2 },
        { label: 'Invoices & Billing', href: '/invoices', icon: FileText },
      ],
    },
    {
      group: 'Analytics & Admin',
      items: [
        { label: 'Reports', href: '/reports', icon: BarChart3 },
        { label: 'Settings', href: '/settings', icon: Settings },
        { label: 'Design System', href: '/design', icon: Palette },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 z-30 select-none shrink-0 h-screen sticky top-0',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/80">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm font-bold text-base">
              H
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-foreground">HaulTrack</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                East Africa
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/" className="mx-auto">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm font-bold text-base">
              H
            </div>
          </Link>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => {
          // If driver, only show operations
          if (isDriver && group.group !== 'Operations') return null;

          return (
            <div key={group.group} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Organization Badge & User summary */}
      <div className="p-3 border-t border-border bg-card">
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 border border-border/60">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
              {user?.name ? user.name.slice(0, 2) : 'HT'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'Transporter'}</p>
              <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span>{user?.role || 'User'}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
              {user?.name ? user.name.slice(0, 2) : 'HT'}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

