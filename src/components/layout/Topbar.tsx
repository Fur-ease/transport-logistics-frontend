'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import {
  Search,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Shield,
  Layers,
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
import { useAuth } from '@/components/providers/AuthProvider';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const openCommandPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    );
  };

  return (
    <header className="sticky top-0 z-20 h-16 w-full glass-surface border-b border-border flex items-center justify-between px-4 sm:px-6">
      {/* Search trigger button */}
      <div className="flex items-center gap-3">
        <button
          onClick={openCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:border-primary/50 transition-colors shadow-sm w-48 sm:w-64 cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">Search HaulTrack...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground border border-border">
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
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 rounded-lg"
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
              className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border shadow-sm cursor-pointer"
            >
              <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase">
                {user?.name ? user.name[0] : 'U'}
              </div>
              <span className="text-xs font-semibold text-foreground max-w-[100px] truncate hidden sm:inline-block">
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
  );
}

