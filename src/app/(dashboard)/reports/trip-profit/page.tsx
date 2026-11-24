'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  ChevronDown,
  Layers,
  Calendar,
  Truck,
  User,
  Building2,
  RefreshCw,
  ExternalLink,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Skeleton } from '@/components/ui/Skeleton';
import { ExportConfirmModal } from '@/components/shared/ExportConfirmModal';
import { api } from '@/lib/api';
import { LIVE_REFETCH_MS } from '@/lib/liveSync';
import { formatKES, formatNumber, formatDate, formatKm } from '@/lib/formatters';
import {
  TripProfitReport,
  TripProfitRow,
  TruckSummary,
  Truck as TruckType,
  Driver as DriverType,
  Customer as CustomerType,
} from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';

export default function TripProfitSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';

  // Read URL query params
  const monthParam = searchParams.get('month') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const allTrucksParam = searchParams.get('all_trucks') === '1';
  const allTimeParam = searchParams.get('all_time') === '1';
  const truckIdsRaw = searchParams.get('truck_ids') || '';
  const truckIdsParam = useMemo(() => truckIdsRaw.split(',').filter(Boolean), [truckIdsRaw]);
  const driverIdParam = searchParams.get('driver_id') || '';
  const customerIdParam = searchParams.get('customer_id') || '';
  const groupByParam = searchParams.get('group_by') || 'none';
  const statusParam = searchParams.get('status') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Sorting state
  const [sortField, setSortField] = useState<keyof TripProfitRow>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Export Modal state
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    format: 'pdf' | 'csv';
    scope: 'filtered' | 'all';
    title: string;
    description: string;
    rowCount: number;
  }>({
    isOpen: false,
    format: 'pdf',
    scope: 'filtered',
    title: '',
    description: '',
    rowCount: 0,
  });

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
    // Reset page to 1 on filter changes unless page itself is changed
    if (!('page' in newParams)) {
      params.delete('page');
    }
    router.push(`?${params.toString()}`);
  };

  // Pre-load reference lists for filters
  const { data: trucksData } = useQuery<{ data: TruckType[] }>({
    queryKey: ['trucks-select'],
    queryFn: () => api.get('/trucks?per_page=100'),
  });

  const { data: driversData } = useQuery<{ data: DriverType[] }>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers?per_page=100'),
  });

  const { data: customersData } = useQuery<{ data: CustomerType[] }>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers?per_page=100'),
  });

  // Build query string for API
  const apiQueryString = useMemo(() => {
    const q = new URLSearchParams();
    if (allTimeParam) {
      q.set('all_time', '1');
    } else if (fromParam && toParam) {
      q.set('from', fromParam);
      q.set('to', toParam);
    } else if (monthParam) {
      q.set('month', monthParam);
    } else {
      // Default to current month if nothing selected and not all_time
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      q.set('month', currentMonth);
    }

    if (allTrucksParam) {
      q.set('all_trucks', '1');
    } else if (truckIdsParam.length > 0) {
      truckIdsParam.forEach((id) => q.append('truck_ids[]', id));
    }

    if (driverIdParam) q.set('driver_id', driverIdParam);
    if (customerIdParam) q.set('customer_id', customerIdParam);
    if (groupByParam && groupByParam !== 'none') q.set('group_by', groupByParam);
    if (statusParam) q.set('status[]', statusParam);
    if (pageParam > 1) q.set('page', pageParam.toString());

    return q.toString();
  }, [
    allTimeParam,
    fromParam,
    toParam,
    monthParam,
    allTrucksParam,
    truckIdsParam,
    driverIdParam,
    customerIdParam,
    groupByParam,
    statusParam,
    pageParam,
  ]);

  // Fetch report data
  const {
    data: reportResponse,
    isLoading,
    refetch,
  } = useQuery<{ data: TripProfitReport }>({
    queryKey: ['trip-profit-report', apiQueryString],
    queryFn: () => api.get(`/reports/trip-profit?${apiQueryString}`),
    refetchInterval: LIVE_REFETCH_MS,
  });

  const report = reportResponse?.data;
  const summary = report?.summary;
  const rawTrips = report?.trips;
  const trips = useMemo(() => rawTrips || [], [rawTrips]);
  const groups = report?.groups || [];
  const truckSummaries = report?.truck_summaries || [];

  // Sort trips
  const sortedTrips = useMemo(() => {
    const list = [...trips];
    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [trips, sortField, sortAsc]);

  const handleSort = (field: keyof TripProfitRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Open Export confirmation
  const handleOpenExport = (format: 'pdf' | 'csv', scope: 'filtered' | 'all') => {
    const count = scope === 'all'
      ? (summary?.trips_count || 0)
      : (report?.pagination?.total || trips.length);

    let desc = '';
    if (scope === 'all') {
      desc = 'All trucks, all time, across the entire company transport history.';
    } else {
      const parts = [];
      if (allTrucksParam) parts.push('All trucks');
      else if (truckIdsParam.length > 0) parts.push(`${truckIdsParam.length} truck(s) selected`);
      else parts.push('All trucks');

      if (allTimeParam) parts.push('All time');
      else if (monthParam) parts.push(`Month: ${monthParam}`);
      else if (fromParam && toParam) parts.push(`${fromParam} to ${toParam}`);
      else parts.push('Current month');

      desc = `Filtered: ${parts.join(', ')} (${count} matching trips)`;
    }

    setExportModal({
      isOpen: true,
      format,
      scope,
      title: `Export ${format.toUpperCase()} (${scope === 'all' ? 'Whole Dataset' : 'Filtered'})`,
      description: desc,
      rowCount: count,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip Profit Sheet"
        description="Comprehensive profitability audit per trip and truck based on verified delivery dates and approved expenses."
        backHref="/reports"
        backLabel="Back to reports"
        actions={
          !isDriver ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-1.5"
                title="Refresh report"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5 font-medium">
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Sheet</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Filtered Selection ({report?.pagination?.total ?? trips.length} trips)
                  </div>
                  <DropdownMenuItem onClick={() => handleOpenExport('pdf', 'filtered')}>
                    <FileText className="h-4 w-4 mr-2 text-primary" />
                    <span>Export Filtered as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenExport('csv', 'filtered')}>
                    <Download className="h-4 w-4 mr-2 text-success" />
                    <span>Export Filtered as CSV</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Whole Organization Data
                  </div>
                  <DropdownMenuItem onClick={() => handleOpenExport('pdf', 'all')}>
                    <FileText className="h-4 w-4 mr-2 text-primary" />
                    <span>Export Whole Data as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenExport('csv', 'all')}>
                    <Download className="h-4 w-4 mr-2 text-success" />
                    <span>Export Whole Data as CSV</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null
        }
      />

      {/* Filter Bar */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Report Filters &amp; Dimensions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={allTrucksParam ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() =>
                  updateFilters({
                    all_trucks: allTrucksParam ? null : '1',
                    truck_ids: null,
                  })
                }
              >
                All Trucks
              </Button>
              <Button
                variant={allTimeParam ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() =>
                  updateFilters({
                    all_time: allTimeParam ? null : '1',
                    month: null,
                    from: null,
                    to: null,
                  })
                }
              >
                All Time
              </Button>
              {(monthParam || fromParam || truckIdsParam.length > 0 || driverIdParam || customerIdParam || groupByParam !== 'none') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => router.push('?')}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {/* Truck Selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Truck</label>
              <select
                disabled={allTrucksParam}
                value={truckIdsParam[0] || ''}
                onChange={(e) =>
                  updateFilters({
                    truck_ids: e.target.value || null,
                    all_trucks: null,
                  })
                }
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">{allTrucksParam ? 'All Trucks Selected' : 'Choose Truck...'}</option>
                {trucksData?.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reg_number} ({t.make})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Picker */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Month Period</label>
              <input
                type="month"
                disabled={allTimeParam}
                value={monthParam}
                onChange={(e) =>
                  updateFilters({
                    month: e.target.value || null,
                    from: null,
                    to: null,
                    all_time: null,
                  })
                }
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Driver */}
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

            {/* Customer */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Customer</label>
              <select
                value={customerIdParam}
                onChange={(e) => updateFilters({ customer_id: e.target.value || null })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Customers</option>
                {customersData?.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Trip Status</label>
              <select
                value={statusParam}
                onChange={(e) => updateFilters({ status: e.target.value || null })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Completed &amp; Active</option>
                <option value="delivered">Delivered</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
                <option value="in_transit">In Transit</option>
                <option value="planned">Planned</option>
              </select>
            </div>

            {/* Group By */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Grouping Mode</label>
              <select
                value={groupByParam}
                onChange={(e) => updateFilters({ group_by: e.target.value })}
                className="w-full text-xs h-8 rounded-md border border-input bg-card px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="none">No Grouping</option>
                <option value="by_truck">Group by Truck</option>
                <option value="by_month">Group by Month</option>
                <option value="by_truck_month">Group Truck &rarr; Month</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          title="Trips Included"
          value={isLoading ? '...' : formatNumber(summary?.trips_count || 0)}
          subtitle={summary?.total_km ? `${formatKm(summary.total_km)} total` : 'Direct deliveries'}
        />
        <StatCard
          title="Net Revenue"
          value={isLoading ? '...' : formatKES(summary?.revenue || 0)}
          subtitle={`Agreed ${formatKES(summary?.agreed_revenue || 0)} • CN ${formatKES(summary?.credit_note_amount || 0)}`}
        />
        <StatCard
          title="Direct Trip Costs"
          value={isLoading ? '...' : formatKES(summary?.total_direct_costs || 0)}
          subtitle="Approved direct costs"
        />
        <StatCard
          title="Total Contribution"
          value={isLoading ? '...' : formatKES(summary?.contribution || 0)}
          valueClassName={
            (summary?.contribution || 0) < 0 ? 'text-destructive font-bold' : 'text-success font-bold'
          }
          subtitle="Net revenue minus direct costs"
        />
        <StatCard
          title="Contribution Margin"
          value={
            isLoading
              ? '...'
              : summary?.margin_pct !== null && summary?.margin_pct !== undefined
              ? `${summary.margin_pct.toFixed(1)}%`
              : 'â€”'
          }
          valueClassName={
            (summary?.margin_pct || 0) < 0 ? 'text-destructive font-bold' : 'text-foreground font-bold'
          }
          subtitle="Margin on direct costs"
        />
        <StatCard
          title="Avg / Trip"
          value={isLoading ? '...' : formatKES(summary?.avg_contribution_per_trip || 0)}
          subtitle="Net return per trip"
        />
      </div>

      {/* Mandatory Explanatory Notice Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-secondary/80 border border-border text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>
            <strong>Calculation Rule:</strong> Contribution = net revenue (agreed rate minus applied credit notes) minus approved direct trip costs. Shared depot overheads and truck depreciation are not deducted.
          </span>
        </div>
        {summary && summary.pending_expenses_count > 0 && (
          <Link
            href="/operations/missing-entries?issue_type=expense_pending_stale"
            className="inline-flex items-center gap-1.5 shrink-0 text-amber-600 dark:text-amber-400 font-semibold hover:underline bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded border border-amber-300 dark:border-amber-800"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{summary.pending_expenses_count} pending expenses excluded &rarr;</span>
          </Link>
        )}
      </div>

      {/* Per-Truck Summary Block (When Grouping by Truck) */}
      {(groupByParam === 'by_truck' || groupByParam === 'by_truck_month') && truckSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span>Per-Truck Fleet Performance Summary</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Aggregate contribution and return per truck for the selected delivery period.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead className="bg-secondary/60 text-muted-foreground uppercase border-y border-border">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-medium">Truck Reg</th>
                    <th className="py-2.5 px-3 text-center font-medium">Trips Made</th>
                    <th className="py-2.5 px-3 text-right font-medium">Total Distance</th>
                    <th className="py-2.5 px-3 text-right font-medium">Agreed</th>
                    <th className="py-2.5 px-3 text-right font-medium">Credit Note</th>
                    <th className="py-2.5 px-3 text-right font-medium">Net Revenue</th>
                    <th className="py-2.5 px-3 text-right font-medium">Direct Costs</th>
                    <th className="py-2.5 px-3 text-right font-medium">Contribution</th>
                    <th className="py-2.5 px-3 text-right font-medium">Margin %</th>
                    <th className="py-2.5 px-3 text-right font-medium">Return / Trip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {truckSummaries.map((ts) => (
                    <tr key={ts.truck_id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-foreground">
                        <Link href={`/trucks/${ts.truck_id}`} className="hover:underline text-primary">
                          {ts.truck_reg}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-center tabular-nums font-medium">{ts.trips_made}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatKm(ts.total_km)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatKES(ts.agreed_revenue ?? ts.revenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatKES(ts.credit_note_amount ?? 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatKES(ts.revenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatKES(ts.direct_costs)}</td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums font-bold ${
                          ts.contribution < 0 ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {formatKES(ts.contribution)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">
                        {ts.margin_pct !== null ? `${ts.margin_pct.toFixed(1)}%` : 'â€”'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">
                        {formatKES(ts.contribution_per_trip)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Trip Profit Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Trip Profitability Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Showing {trips.length} of {report?.pagination?.total || trips.length} matching delivery trips
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-secondary/70 text-muted-foreground uppercase border-y border-border">
                <tr>
                  <th
                    className="py-3 px-3 text-left font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('reference')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Ref</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-left font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Delivered</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-left font-medium">Truck &amp; Driver</th>
                  <th className="py-3 px-3 text-left font-medium">Customer &amp; Route</th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Agreed</th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Credit Note</th>
                  <th
                    className="py-3 px-3 text-right font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('revenue')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Net Revenue</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Fuel</th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Allowances</th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Tolls / Cess</th>
                  <th className="py-3 px-3 text-right font-medium text-muted-foreground">Other</th>
                  <th
                    className="py-3 px-3 text-right font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('total_direct_costs')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Costs</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('contribution')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Contribution</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('margin_pct')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Margin</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={14} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : sortedTrips.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-10 text-center text-muted-foreground">
                      No delivery trips matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  sortedTrips.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        row.is_negative ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <Link href={`/trips/${row.id}`} className="hover:underline text-primary">
                          {row.reference}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-foreground">{row.truck_reg}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                          {row.driver_name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground truncate max-w-[160px]">
                          {row.customer_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {row.route}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatKES(row.agreed_revenue ?? row.revenue)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatKES(row.credit_note_amount ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-foreground">
                        {formatKES(row.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {formatKES(row.fuel)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {formatKES(row.allowance)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {formatKES(row.tolls_levies)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {formatKES(row.other_direct)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-foreground">
                        {formatKES(row.total_direct_costs)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div
                          className={`font-bold ${
                            row.is_negative ? 'text-destructive' : 'text-success'
                          }`}
                        >
                          {formatKES(row.contribution)}
                        </div>
                        {row.is_negative && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive uppercase tracking-wider bg-destructive/10 px-1 py-0.2 rounded border border-destructive/20 mt-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            <span>LOSS</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                        {row.margin_pct !== null ? `${row.margin_pct.toFixed(1)}%` : 'â€”'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Grand Totals Footer */}
              {summary && summary.trips_count > 0 && (
                <tfoot className="bg-secondary/90 border-t-2 border-border font-bold text-foreground">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-xs">
                      Grand Totals ({summary.trips_count} trips)
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.agreed_revenue ?? summary.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.credit_note_amount ?? 0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono">
                      {formatKES(summary.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.fuel_cost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.allowance_cost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.tolls_levies_cost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono text-muted-foreground">
                      {formatKES(summary.other_direct_cost)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono">
                      {formatKES(summary.total_direct_costs)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right tabular-nums text-xs font-mono ${
                        summary.contribution < 0 ? 'text-destructive' : 'text-success'
                      }`}
                    >
                      {formatKES(summary.contribution)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-xs font-mono">
                      {summary.margin_pct !== null ? `${summary.margin_pct.toFixed(1)}%` : 'â€”'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {report?.pagination && report.pagination.last_page > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border text-xs">
              <span className="text-muted-foreground">
                Page {report.pagination.current_page} of {report.pagination.last_page} ({report.pagination.total} total)
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={report.pagination.current_page <= 1}
                  onClick={() =>
                    updateFilters({ page: (report.pagination.current_page - 1).toString() })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={report.pagination.current_page >= report.pagination.last_page}
                  onClick={() =>
                    updateFilters({ page: (report.pagination.current_page + 1).toString() })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Confirmation Dialog */}
      <ExportConfirmModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal((prev) => ({ ...prev, isOpen: false }))}
        title={exportModal.title}
        scopeDescription={exportModal.description}
        rowCount={exportModal.rowCount}
        format={exportModal.format}
        scope={exportModal.scope}
        exportEndpoint="/reports/trip-profit/export"
        filters={{
          month: monthParam || null,
          from: fromParam || null,
          to: toParam || null,
          all_trucks: allTrucksParam,
          all_time: allTimeParam,
          truck_ids: truckIdsParam,
          driver_id: driverIdParam || null,
          customer_id: customerIdParam || null,
          status: statusParam ? [statusParam] : null,
          group_by: groupByParam,
        }}
      />
    </div>
  );
}

