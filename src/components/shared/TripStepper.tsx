import React from 'react';
import { TripStatus } from '@/types';
import { Check, Clock, Truck, CheckCircle2, FileText, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripStepperProps {
  currentStatus: TripStatus;
  className?: string;
}

const STEPS = [
  { key: 'planned', label: 'Planned', icon: Clock },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { key: 'invoiced', label: 'Invoiced', icon: FileText },
  { key: 'paid', label: 'Paid', icon: DollarSign },
];

export function TripStepper({ currentStatus, className }: TripStepperProps) {
  if (currentStatus === 'cancelled') {
    return (
      <div className={cn('flex items-center gap-2 p-3 bg-destructive-bg text-destructive rounded-lg border border-destructive/20 text-sm font-medium', className)}>
        <X className="h-4 w-4" />
        <span>This trip was cancelled.</span>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className={cn('w-full py-2 overflow-x-auto', className)}>
      <div className="flex items-center justify-between min-w-[280px]">
        {STEPS.map((step, index) => {
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center group">
                <div
                  className={cn(
                    'flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                    isCompleted && 'bg-primary border-primary text-white',
                    isCurrent && 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20',
                    !isCompleted && !isCurrent && 'bg-secondary border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </div>
                <span
                  className={cn(
                    'mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium tracking-tight whitespace-nowrap',
                    isCurrent && 'text-primary font-semibold',
                    isCompleted && 'text-foreground',
                    !isCompleted && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-[2px] flex-1 mx-1 sm:mx-2 -mt-4 sm:-mt-5 transition-all',
                    currentIndex > index ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

