'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Truck,
  MapPin,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings,
  PlusCircle,
  Receipt,
  Search,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-[550px] border-border bg-card">
        <Command className="w-full bg-card">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search trucks, trips, customers or type a command..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Dashboard Overview</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/trips'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span>Trips & Dispatch</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/trucks'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Truck className="h-4 w-4 text-primary" />
                <span>Fleet Trucks</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/drivers'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Users className="h-4 w-4 text-primary" />
                <span>Drivers Roster</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/customers'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Building2 className="h-4 w-4 text-primary" />
                <span>Customers & Receivables</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/invoices'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <FileText className="h-4 w-4 text-primary" />
                <span>Invoices & Payments</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/reports'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Operational Reports</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/driver'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Receipt className="h-4 w-4 text-accent" />
                <span>Driver Mobile View</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/settings'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span>Settings & Profile</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase mt-2">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/trips?action=create'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <PlusCircle className="h-4 w-4 text-accent" />
                <span>Create New Trip</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/driver'))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-lg hover:bg-muted cursor-pointer text-foreground"
              >
                <Receipt className="h-4 w-4 text-accent" />
                <span>Submit Trip Expense</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

