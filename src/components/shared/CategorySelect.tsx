'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { value: 'fuel', label: 'Fuel (Diesel Refill)' },
  { value: 'allowance', label: 'Driver Allowance (Per Diem)' },
  { value: 'toll', label: 'Toll & Weighing Cess' },
  { value: 'county_levy_cess', label: 'County Levy / Cess' },
  { value: 'border_fees', label: 'Border Clearance Fees' },
  { value: 'loading_offloading', label: 'Loading / Offloading' },
  { value: 'repairs', label: 'Emergency En-Route Repairs' },
  { value: 'other', label: 'Other Incidentals' },
];

export function formatCategoryLabel(value: string) {
  if (!value) return '';
  const known = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.value === value);
  if (known) return known.label;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface CategorySelectProps {
  value?: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  name?: string;
}

export function CategorySelect({
  value = '',
  onChange,
  suggestions = [],
  placeholder = 'Search or create category...',
  className,
  name,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayValue = open ? query : value ? formatCategoryLabel(value) : '';

  const options = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    DEFAULT_EXPENSE_CATEGORIES.forEach((c) => map.set(c.value, c));
    suggestions.forEach((s) => {
      const v = normalizeCategory(s);
      if (!v) return;
      if (!map.has(v)) map.set(v, { value: v, label: formatCategoryLabel(s) });
    });
    if (value && !map.has(value)) {
      map.set(value, { value, label: formatCategoryLabel(value) });
    }
    return Array.from(map.values());
  }, [suggestions, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const canCreate = useMemo(() => {
    const normalized = normalizeCategory(query);
    if (!normalized) return false;
    return !options.some((o) => o.value === normalized || o.label.toLowerCase() === query.trim().toLowerCase());
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commit = (v: string) => {
    const normalized = normalizeCategory(v);
    if (!normalized) return;
    onChange(normalized);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="relative">
        <input
          ref={inputRef}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
          }}
          onClick={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-lg border border-input bg-card px-3 pr-8 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          tabIndex={-1}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-secondary/70 transition-colors',
                opt.value === value && 'bg-secondary/50 font-medium',
              )}
            >
              <span className="block text-foreground">{opt.label}</span>
              {opt.label.toLowerCase() !== opt.value.replace(/_/g, ' ') && (
                <span className="block text-[11px] text-muted-foreground font-mono">{opt.value}</span>
              )}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(query)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/70 border-t border-border flex items-center gap-2 text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Create &quot;{query.trim()}&quot;</span>
            </button>
          )}
          {!filtered.length && !canCreate && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No categories found</div>
          )}
        </div>
      )}
    </div>
  );
}
