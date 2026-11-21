'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Download,
  FileText,
  UserCheck,
  ExternalLink,
  ShieldAlert,
  Clock,
  Layers,
  Wrench,
  XCircle,
  Truck as TruckIcon,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, getAuthToken } from '@/lib/api';
import { syncFinancialState } from '@/lib/liveSync';
import { formatDate } from '@/lib/formatters';
import {
  DataIssue,
  MissingEntriesResponse,
  Truck as TruckType,
  Driver as DriverType,
  User as UserType,
} from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';

const RULE_METADATA: Record<string, { label: string; category: string; severity: 'critical' | 'warning' | 'info' }> = {
  delivered_no_fuel: { label: 'No fuel expense recorded', category: 'Costs', severity: 'critical' },
  trip_no_allowance: { label: 'Driver allowance missing', category: 'Costs', severity: 'warning' },
  fuel_missing_litres_odo: { label: 'Fuel missing litres or odometer', category: 'Telemetry', severity: 'warning' },
  expense_missing_receipt: { label: 'Expense missing receipt photo', category: 'Audit', severity: 'warning' },
  trip_odometer_anomaly: { label: 'Odometer reading anomaly', category: 'Integrity', severity: 'critical' },
  trip_in_transit_stale: { label: 'Trip stalled in transit', category: 'Operations', severity: 'critical' },
  delivered_unbilled_invoice: { label: 'Delivered trip not yet invoiced', category: 'Billing', severity: 'critical' },
  advance_unreconciled_stale: { label: 'Driver advance unreconciled', category: 'Advances', severity: 'warning' },
  expense_pending_stale: { label: 'Expense stuck in pending approval', category: 'Approvals', severity: 'warning' },
  trip_zero_revenue: { label: 'Trip revenue is zero', category: 'Billing', severity: 'critical' },
  truck_idle_gap: { label: 'Truck idle with no trips', category: 'Fleet', severity: 'info' },
  document_missing_due_date: { label: 'Compliance doc missing expiry', category: 'Compliance', severity: 'critical' },
  document_expiring_soon: { label: 'Compliance document expiring soon', category: 'Compliance', severity: 'warning' },
};

export default function MissingEntriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';

  // Read URL query parameters
  const statusParam = searchParams.get('status') || 'open';
  const ruleKeyParam = searchParams.get('rule_key') || searchParams.get('issue_type') || '';
  const truckIdParam = searchParams.get('truck_id') || '';
  const driverIdParam = searchParams.get('driver_id') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Dismiss modal state
  const [dismissTarget, setDismissTarget] = useState<DataIssue | null>(null);
  const [dismissReason, setDismissReason] = useState<string>('');
  const [isSubmittingDismiss, setIsSubmittingDismiss] = useState<boolean>(false);

  // Update query params helper
  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === '') {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    });
    if (!('page' in newParams)) {
      params.delete('page');
    }
    router.push(`?${params.toString()}`);
  };

  // Pre-load reference lists for filters and assignment
  const { data: trucksData } = useQuery<{ data: TruckType[] }>({
    queryKey: ['trucks-select'],
    queryFn: () => api.get('/trucks?per_page=100'),
  });

  const { data: driversData } = useQuery<{ data: DriverType[] }>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers?per_page=100'),
  });

  const { data: staffData } = useQuery<{ data: UserType[] }>({
    queryKey: ['staff-users'],
    queryFn: () => api.get('/settings/users'),
    enabled: !isDriver,
  });

  // Query string for API
  const apiQueryString = useMemo(() => {
    const q = new URLSearchParams();
    if (statusParam) q.set('status', statusParam);
    if (ruleKeyParam) q.set('rule_key', ruleKeyParam);
    if (truckIdParam) q.set('truck_id', truckIdParam);
    if (driverIdParam) q.set('driver_id', driverIdParam);
    if (fromParam) q.set('from', fromParam);
    if (toParam) q.set('to', toParam);
    if (pageParam > 1) q.set('page', pageParam.toString());
    return q.toString();
  }, [statusParam, ruleKeyParam, truckIdParam, driverIdParam, fromParam, toParam, pageParam]);

  // Fetch missing entries dataset
  const {
    data: issuesResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<MissingEntriesResponse>({
    queryKey: ['missing-entries', apiQueryString],
    queryFn: () => api.get(`/missing-entries?${apiQueryString}`),
  });

  const summary = issuesResponse?.summary;
  const issues = issuesResponse?.data || [];
  const pagination = issuesResponse?.meta;

  // Trigger manual rescan mutation
  const scanMutation = useMutation({
    mutationFn: () => api.post('/missing-entries/scan', {}),
    onSuccess: async (_data: unknown) => {
      await syncFinancialState(queryClient);
      toast.success('Fleet data quality scan completed.');
    },
    onError: (err: unknown) => {
      toast.error('Failed to trigger scan.');
    },
  });

  // Dismiss issue mutation
  const handleDismissSubmit = async () => {
    if (!dismissTarget) return;
    if (dismissReason.trim().length < 5) {
      toast.error('Please provide a reason of at least 5 characters.');
      return;
    }

    setIsSubmittingDismiss(true);
    try {
      await api.post(`/missing-entries/${dismissTarget.id}/dismiss`, {
        reason: dismissReason.trim(),
      });
      await syncFinancialState(queryClient);
      toast.success('Data issue dismissed. It will not reappear unless data changes.');
      setDismissTarget(null);
      setDismissReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dismiss issue.';
      toast.error(msg);
    } finally {
      setIsSubmittingDismiss(false);
    }
  };

  // Assign issue mutation
  const handleAssignIssue = async (issueId: number, userId: number | null) => {
    try {
      await api.post(`/missing-entries/${issueId}/assign`, {
        assigned_to: userId,
      });
      await syncFinancialState(queryClient);
      toast.success('Assigned staff updated.');
    } catch (err: unknown) {
      toast.error('Failed to assign staff.');
    }
  };

  // Export missing entries helper
  const handleExport = (format: 'csv' | 'pdf', scope: 'filtered' | 'all') => {
    const token = getAuthToken();
    const query = new URLSearchParams();
    query.set('format', format);
    query.set('scope', scope);

    if (scope === 'filtered') {
      if (statusParam) query.set('status', statusParam);
      if (ruleKeyParam) query.set('rule_key', ruleKeyParam);
      if (truckIdParam) query.set('truck_id', truckIdParam);
      if (driverIdParam) query.set('driver_id', driverIdParam);
      if (fromParam) query.set('from', fromParam);
      if (toParam) query.set('to', toParam);
    }

    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/missing-entries/export?${query.toString()}`;

    // For file download with auth token
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export download failed');
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `HaulTrack_MissingEntries_${scope}_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success(`${format.toUpperCase()} export downloaded successfully`);
      })
      .catch((err) => {
        toast.error(err.message || 'Export error');
      });
  };

  // Helper to determine the "Fix" link for an issue
  const getFixLink = (issue: DataIssue): { href: string; label: string } => {
    if (issue.trip) {
      return { href: `/trips/${issue.trip.id}`, label: 'View & Edit Trip' };
    }
    if (issue.truck) {
      return { href: `/trucks/${issue.truck.id}`, label: 'View Truck' };
    }
    if (issue.driver) {
      return { href: `/drivers/${issue.driver.id}`, label: 'View Driver' };
    }
    return { href: '/trips', label: 'View Operations' };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span>Missing Entries &amp; Data Quality</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
              Advancement C
            </span>
          </div>
        }
        description="Continuous scanner detecting incomplete trip logs, missing receipts, unbilled deliveries, and telemetry anomalies."
        backHref="/"
        backLabel="Back to dashboard"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{scanMutation.isPending ? 'Scanning...' : 'Rescan Now'}</span>
            </Button>

            {!isDriver && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Current Filtered List
                  </div>
                  <DropdownMenuItem onClick={() => handleExport('csv', 'filtered')}>
                    <FileText className="h-4 w-4 mr-2 text-success" />
                    <span>Export Filtered as CSV</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf', 'filtered')}>
                    <FileText className="h-4 w-4 mr-2 text-primary" />
                    <span>Export Filtered as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Whole Organization
                  </div>
                  <DropdownMenuItem onClick={() => handleExport('csv', 'all')}>
                    <Download className="h-4 w-4 mr-2 text-success" />
                    <span>Export All Issues (CSV)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf', 'all')}>
                    <Download className="h-4 w-4 mr-2 text-primary" />
                    <span>Export All Issues (PDF)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Open Data Issues"
          value={isLoading ? '...' : (summary?.total_open ?? 0)}
          subtitle="Require operational fix"
          valueClassName={(summary?.total_open ?? 0) > 0 ? 'text-destructive font-bold' : 'text-success font-bold'}
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
        />
        <StatCard
          title="Data Completeness"
          value={isLoading ? '...' : `${summary?.data_completeness_pct ?? 100}%`}
          subtitle={`${summary?.clean_trips ?? 0} of ${summary?.total_trips ?? 0} trips clean`}
          valueClassName={(summary?.data_completeness_pct ?? 100) >= 90 ? 'text-success font-bold' : 'text-amber-500 font-bold'}
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
        />
        <StatCard
          title="Oldest Open Issue"
          value={isLoading ? '...' : `${summary?.oldest_age_days ?? 0} days`}
          subtitle="Age of oldest unfixed issue"
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title="Monitored Rules"
          value="13 Active Rules"
          subtitle="Cross-module data integrity"
          icon={<ShieldAlert className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Category breakdown filter pills */}
      {summary && summary.by_category && Object.keys(summary.by_category).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-card border border-border text-xs">
          <span className="text-muted-foreground font-semibold mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            <span>Open By Rule:</span>
          </span>
          {Object.entries(summary.by_category).map(([rKey, count]) => {
            const meta = RULE_METADATA[rKey];
            const isSelected = ruleKeyParam === rKey;
            return (
              <button
                key={rKey}
                onClick={() => updateFilters({ rule_key: isSelected ? null : rKey })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-sm'
                    : 'bg-secondary/70 hover:bg-muted text-foreground border-border'
                }`}
              >
                <span>{meta?.label || rKey}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/80 font-bold">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter Issues</span>
            </div>
            <div className="flex items-center gap-2">
              {(statusParam !== 'open' || ruleKeyParam || truckIdParam || driverIdParam) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => router.push('?status=open')}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Status</label>
              <select
                value={statusParam}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="open">Open (Needs Attention)</option>
                <option value="dismissed">Dismissed (With Reason)</option>
                <option value="resolved">Resolved</option>
                <option value="all">All Statuses</option>
              </select>
            </div>

            {/* Rule Selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Issue Rule</label>
              <select
                value={ruleKeyParam}
                onChange={(e) => updateFilters({ rule_key: e.target.value || null })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All 13 Detection Rules</option>
                {Object.entries(RULE_METADATA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Truck Selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Truck</label>
              <select
                value={truckIdParam}
                onChange={(e) => updateFilters({ truck_id: e.target.value || null })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="">All Fleet Trucks</option>
                {trucksData?.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reg_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Driver</label>
              <select
                value={driverIdParam}
                onChange={(e) => updateFilters({ driver_id: e.target.value || null })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Drivers</option>
                {driversData?.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Issues Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Detected Data Quality Issues</CardTitle>
            <CardDescription className="text-xs">
              Showing {issues.length} records • Click &apos;Fix&apos; to navigate and complete missing details.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/70 text-muted-foreground uppercase border-y border-border">
                <tr>
                  <th className="py-3 px-3 text-left font-medium">Issue / Rule</th>
                  <th className="py-3 px-3 text-left font-medium">Related Subject</th>
                  <th className="py-3 px-3 text-left font-medium">Truck &amp; Driver</th>
                  <th className="py-3 px-3 text-center font-medium">Age</th>
                  <th className="py-3 px-3 text-left font-medium">Assigned Staff</th>
                  <th className="py-3 px-3 text-center font-medium">Status</th>
                  <th className="py-3 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2 opacity-80" />
                      <p className="font-semibold text-foreground">No data issues found!</p>
                      <p className="text-xs mt-1">All trip records and expenses meet completeness rules.</p>
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const ruleKey = (issue.rule_key ?? (issue as any).rule ?? 'unknown') as string;
                    const meta = RULE_METADATA[ruleKey] || {
                      label: String(ruleKey).replace(/_/g, ' '),
                      category: (issue as any).category || 'General',
                      severity: ((issue as any).severity as 'critical' | 'warning' | 'info') || 'warning',
                    };
                    const fix = getFixLink(issue);

                    return (
                      <tr key={issue.id} className="hover:bg-muted/40 transition-colors">
                        {/* Rule Column */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {meta.severity === 'critical' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <span>{meta.label}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Category: <span className="font-medium text-foreground">{meta.category}</span>
                          </div>
                        </td>

                        {/* Subject Column */}
                        <td className="py-3 px-3">
                          {issue.trip ? (
                            <div>
                              <Link
                                href={`/trips/${issue.trip.id}`}
                                className="font-mono font-bold text-primary hover:underline"
                              >
                                {issue.trip.reference}
                              </Link>
                              <div className="text-[11px] text-muted-foreground">{issue.trip.route}</div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground font-mono">
                              {issue.subject_type?.split('\\').pop()} #{issue.subject_id}
                            </div>
                          )}
                        </td>

                        {/* Truck & Driver */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-semibold text-foreground">
                            {issue.truck?.reg_number || 'â€”'}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {issue.driver?.name || 'â€”'}
                          </div>
                        </td>

                        {/* Age */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-semibold tabular-nums px-2 py-0.5 rounded text-[11px] ${
                              issue.days_outstanding > 7
                                ? 'bg-destructive/10 text-destructive border border-destructive/20 font-bold'
                                : 'text-muted-foreground bg-muted'
                            }`}
                          >
                            {issue.days_outstanding}d
                          </span>
                        </td>

                        {/* Assigned Staff */}
                        <td className="py-3 px-3">
                          {!isDriver && staffData?.data ? (
                            <select
                              value={issue.assigned_to?.id || ''}
                              onChange={(e) =>
                                handleAssignIssue(
                                  issue.id,
                                  e.target.value ? parseInt(e.target.value, 10) : null
                                )
                              }
                              className="text-xs h-7 rounded border border-input bg-card px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[130px]"
                            >
                              <option value="">Unassigned</option>
                              {staffData.data.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-muted-foreground">
                              {issue.assigned_to?.name || 'Unassigned'}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              issue.status === 'open'
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : issue.status === 'dismissed'
                                ? 'bg-muted text-muted-foreground border border-border'
                                : 'bg-success/10 text-success border border-success/20'
                            }`}
                          >
                            {issue.status}
                          </span>
                          {issue.status === 'dismissed' && issue.dismissed_reason && (
                            <div
                              className="text-[10px] text-muted-foreground italic truncate max-w-[120px] mt-0.5"
                              title={issue.dismissed_reason}
                            >
                              &ldquo;{issue.dismissed_reason}&rdquo;
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2 gap-1">
                              <Link href={fix.href}>
                                <span>Fix</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>

                            {issue.status === 'open' && !isDriver && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setDismissTarget(issue);
                                  setDismissReason('');
                                }}
                              >
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border text-xs">
              <span className="text-muted-foreground">
                Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1}
                  onClick={() =>
                    updateFilters({ page: (pagination.current_page - 1).toString() })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() =>
                    updateFilters({ page: (pagination.current_page + 1).toString() })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dismiss Reason Modal */}
      <Dialog open={!!dismissTarget} onOpenChange={() => setDismissTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Dismiss Data Quality Issue</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please provide a valid reason for dismissing this check. The scanner will NOT re-alert you unless the record&apos;s data changes.
            </DialogDescription>
          </DialogHeader>

          {dismissTarget && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-secondary/70 rounded-lg border border-border text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  {RULE_METADATA[(dismissTarget.rule_key ?? (dismissTarget as any).rule ?? '') as string]?.label || (dismissTarget.rule_key ?? (dismissTarget as any).rule ?? 'Unknown rule')}
                </div>
                {dismissTarget.trip && (
                  <div className="text-muted-foreground">
                    Trip: {dismissTarget.trip.reference} ({dismissTarget.trip.route})
                  </div>
                )}
                {dismissTarget.truck && (
                  <div className="text-muted-foreground font-mono">
                    Truck: {dismissTarget.truck.reg_number}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Reason for Dismissal <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="e.g., Fuel card invoice reconciled separately under depot account; receipt physically archived in headquarters."
                  rows={3}
                  className="w-full text-xs rounded-md border border-input bg-card p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground">
                  Minimum 5 characters required for audit trail.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissTarget(null)}
              disabled={isSubmittingDismiss}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDismissSubmit}
              disabled={isSubmittingDismiss || dismissReason.trim().length < 5}
              className="gap-1.5"
            >
              {isSubmittingDismiss ? 'Dismissing...' : 'Confirm Dismissal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

