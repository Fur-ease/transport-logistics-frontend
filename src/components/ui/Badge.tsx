import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none border',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground bg-transparent',
        success: 'border-success/20 bg-success-bg text-success-foreground font-semibold',
        warning: 'border-warning/20 bg-warning-bg text-warning-foreground font-semibold',
        destructive: 'border-destructive/20 bg-destructive-bg text-destructive-foreground font-semibold',
        info: 'border-info/20 bg-info-bg text-info-foreground font-semibold',
        accent: 'border-accent/30 bg-accent text-accent-foreground font-semibold',
        slate: 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

