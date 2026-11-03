import React from 'react';
import { DashboardAlert } from '@/types';
import { AlertCircle, AlertTriangle, FileWarning, Fuel, Wrench, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';

interface AlertListProps {
  alerts: DashboardAlert[];
  className?: string;
  limit?: number;
}

export function AlertList({ alerts, className, limit }: AlertListProps) {
  const displayAlerts = limit ? alerts.slice(0, limit) : alerts;

  if (displayAlerts.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
        All compliance and maintenance tasks are up to date. No anomalies detected.
      </div>
    );
  }

  const getIcon = (type: DashboardAlert['type']) => {
    switch (type) {
      case 'document_expiry':
        return <FileWarning className="h-4 w-4" />;
      case 'maintenance_due':
        return <Wrench className="h-4 w-4" />;
      case 'overdue_invoice':
        return <ShieldAlert className="h-4 w-4" />;
      case 'fuel_anomaly':
        return <Fuel className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityStyle = (severity: DashboardAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-destructive/30 bg-destructive-bg/60 text-destructive-foreground';
      case 'high':
        return 'border-warning/30 bg-warning-bg/60 text-warning-foreground';
      case 'warning':
      default:
        return 'border-border bg-secondary/50 text-foreground';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {displayAlerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'flex items-start gap-3 p-3.5 rounded-xl border transition-colors',
            getSeverityStyle(alert.severity)
          )}
        >
          <div className="mt-0.5 shrink-0 text-foreground">
            {getIcon(alert.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground truncate">{alert.title}</h4>
              {alert.date && (
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatDate(alert.date)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {alert.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

