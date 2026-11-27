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
    <Card className={cn('overflow-hidden transition-all duration-200 hover:shadow-card-hover border-border/80', className)}>
      <CardContent className="p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{title}</p>
            <h3 className={cn('text-lg sm:text-2xl font-semibold tracking-tight text-foreground mt-1 sm:mt-2 tabular-nums break-words', valueClassName)}>
              {value}
            </h3>
          </div>
          {icon && (
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary text-primary shrink-0 border border-border/80 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
              {icon}
            </div>
          )}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/40 text-[11px] sm:text-xs">
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
            {subtitle && <span className="text-muted-foreground truncate">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

