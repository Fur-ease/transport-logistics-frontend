'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, User, Clock, AlertCircle, FileText, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { AuditLog } from '@/types';
import { formatDateTime, formatKES } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

interface HistoryTimelineProps {
  auditableType: string;
  auditableId: number;
  title?: string;
}

export function HistoryTimeline({ auditableType, auditableId, title = 'Audit & Edit History' }: HistoryTimelineProps) {
  const { data, isLoading, error } = useQuery<{ data: AuditLog[] }>({
    queryKey: ['audit-logs', auditableType, auditableId],
    queryFn: () => api.get<{ data: AuditLog[] }>(`/audit-logs?auditable_type=${auditableType}&auditable_id=${auditableId}`),
  });

  const logs = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive-bg text-destructive text-xs">
        Failed to load audit history.
      </div>
    );
  }

  const formatFieldValue = (key: string, val: unknown): string => {
    if (val === null || val === undefined) return 'None';
    if (typeof val === 'number') {
      if (key.includes('amount') || key.includes('rate') || key.includes('cost') || key.includes('expenses')) {
        return formatKES(val);
      }
      if (key.includes('odometer') || key.includes('km')) {
        return `${val.toLocaleString()} km`;
      }
      return val.toString();
    }
    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }
    return String(val);
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'created':
        return 'success';
      case 'updated':
      case 'status_change':
        return 'info';
      case 'unlocked':
        return 'warning';
      case 'voided':
      case 'deleted':
        return 'destructive';
      case 'edited_reapproval_required':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {logs.length} record{logs.length === 1 ? '' : 's'}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border rounded-xl">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-foreground">No audit entries recorded yet</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Edits, re-approvals, and voids will appear here in chronological order.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {logs.map((log) => {
            const oldVals = log.old_values || {};
            const newVals = log.new_values || {};
            const changedKeys = Object.keys(newVals);

            return (
              <div key={log.id} className="relative group">
                {/* Timeline dot */}
                <div className="absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-card bg-primary shadow-sm flex items-center justify-center" />

                <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionBadgeVariant(log.action) as any} className="text-[11px] py-0 px-2">
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {log.user?.name ?? 'System Action'}
                      </span>
                      {log.user?.role && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                          {log.user.role}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>

                  {/* Reason Box */}
                  {log.reason && (
                    <div className="p-2 rounded-lg bg-secondary/80 border border-border text-xs text-foreground flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-primary">Reason: </span>
                        <span>{log.reason}</span>
                      </div>
                    </div>
                  )}

                  {/* Field Diffs */}
                  {changedKeys.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Changes Made:
                      </p>
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        {changedKeys.map((k) => (
                          <div
                            key={k}
                            className="flex flex-wrap items-center gap-1.5 bg-muted/50 px-2 py-1 rounded text-foreground font-mono text-[11px]"
                          >
                            <span className="font-semibold text-muted-foreground capitalize">
                              {k.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-destructive line-through">
                              {formatFieldValue(k, oldVals[k])}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {formatFieldValue(k, newVals[k])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

