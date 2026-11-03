import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <h3 className={cn('text-2xl font-semibold tracking-tight text-foreground mt-2 tabular-nums', valueClassName)}>
              {value}
            </h3>
          </div>
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary shrink-0 border border-border/80">
              {icon}
            </div>
          )}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
            {trend && (
              <span
                className={cn(
                  'font-medium inline-flex items-center',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.value}
              </span>
            )}
            {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

