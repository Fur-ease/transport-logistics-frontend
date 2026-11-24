'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Search,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Shield,
  Layers,
  Menu,
  LayoutDashboard,
  Truck,
  MapPin,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  Receipt,
  Palette,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/Sheet';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout, isDriver } = useAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openCommandPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    );
  };

  const navGroups = [
    {
      group: 'Operations',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Trips & Dispatch', href: '/trips', icon: MapPin },
        { label: 'Missing Entries', href: '/operations/missing-entries', icon: ShieldAlert },
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
        { label: 'Trip Profit Sheet', href: '/reports/trip-profit', icon: FileSpreadsheet },
        { label: 'Reports', href: '/reports', icon: BarChart3 },
        { label: 'Documents Register', href: '/reports/documents', icon: FileText },
        { label: 'Settings', href: '/settings', icon: SettingsIcon },
        { label: 'Design System', href: '/design', icon: Palette },
      ],
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 h-16 w-full glass-surface border-b border-border flex items-center justify-between px-3 sm:px-6">
        {/* Search trigger button & Mobile Menu button */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden h-9 w-9 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
            title="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation</span>
          </Button>

          <button
            onClick={openCommandPalette}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:border-primary/50 transition-colors shadow-sm w-36 sm:w-64 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">Search...</span>
            <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground border border-border">
              ⌘K
            </kbd>
          </button>

          {/* Currency & Region chip */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs font-semibold text-muted-foreground">
            <Layers className="h-3 w-3 text-primary" />
            <span>KES</span>
            <span className="text-[10px] text-muted-foreground/80">• Africa/Nairobi</span>
          </div>
        </div>

        {/* Right controls: Theme, Alerts, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 rounded-lg shrink-0"
            title="Toggle light/dark theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-foreground" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-foreground" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-lg border border-border shadow-sm cursor-pointer"
              >
                <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {user?.name ? user.name[0] : 'U'}
                </div>
                <span className="text-xs font-semibold text-foreground max-w-[80px] sm:max-w-[100px] truncate hidden sm:inline-block">
                  {user?.name?.split(' ')[0] || 'User'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{user?.name || 'Transporter'}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-0.5">{user?.email}</p>
                  <p className="text-[11px] capitalize text-primary font-medium mt-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Role: {user?.role || 'driver'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => (window.location.href = '/settings')}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Settings & Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:bg-destructive-bg focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 flex flex-col">
          <div className="flex h-16 items-center px-5 border-b border-border/80">
            <Link
              href="/"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2.5"
            >
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
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {navGroups.map((group) => {
              if (isDriver && group.group !== 'Operations') return null;
              return (
                <div key={group.group} className="space-y-1">
                  <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {group.group}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-white font-semibold shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

