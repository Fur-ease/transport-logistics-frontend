import React from 'react';
import { formatKES } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface MoneyTextProps {
  amount: number | string | null | undefined;
  variant?: 'default' | 'positive' | 'negative' | 'muted';
  className?: string;
  size?: 'sm' | 'base' | 'lg' | 'xl';
}

export function MoneyText({
  amount,
  variant = 'default',
  className,
  size = 'base',
}: MoneyTextProps) {
  const formatted = formatKES(amount);

  const sizeClass = {
    sm: 'text-xs',
    base: 'text-sm font-medium',
    lg: 'text-base font-semibold',
    xl: 'text-xl font-bold',
  }[size];

  const colorClass = {
    default: 'text-foreground',
    positive: 'text-success font-semibold',
    negative: 'text-destructive font-semibold',
    muted: 'text-muted-foreground',
  }[variant];

  return (
    <span className={cn('tabular-nums font-mono text-right inline-block', sizeClass, colorClass, className)}>
      {formatted}
    </span>
  );
}

