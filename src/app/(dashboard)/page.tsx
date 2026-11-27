'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  MapPin,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { AlertList } from '@/components/shared/AlertList';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatDate } from '@/lib/formatters';
import { DashboardStats } from '@/types';
import { LIVE_REFETCH_MS } from '@/lib/liveSync';
import { useAuth } from '@/components/providers/AuthProvider';

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<'30' | '90' | 'this_month' | 'custom'>('30');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toIsoDate(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    if (preset === 'custom') return;
    const now = new Date();
    if (preset === 'this_month') {
      setFromDate(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(toIsoDate(now));
    } else if (preset === '90') {
      const d = new Date();
      d.setDate(d.getDate() - 89);
      setFromDate(toIsoDate(d));
      setToDate(toIsoDate(now));
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setFromDate(toIsoDate(d));
      setToDate(toIsoDate(now));
    }
  }, [preset]);

  const { data: missingResponse } = useQuery<{
    summary: { total_open: number; data_completeness_pct: number };
  }>({
    queryKey: ['missing-entries-summary'],
    queryFn: () => api.get('/missing-entries?per_page=1'),
    placeholderData: (prev) => prev,
  });
  const missingSummary = missingResponse?.summary;

  const { data: stats, isPending, isError, error, isFetching, refetch, dataUpdatedAt } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', fromDate, toDate],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats', { from: fromDate, to: toDate }),
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const truckRows = stats?.trips_per_truck?.trucks || [];
  const chartData = truckRows.slice(0, 25).map((t) => ({
    reg_number: t.reg_number,
    trips: t.trips_made,
    contribution: t.contribution,
    revenue: t.revenue,
    expenses: t.expenses,
  }));

  const isInitialLoad = isPending && !stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Habari, ${user?.name ? user.name.split(' ')[0] : 'Transporter'}`}
        description="Live fleet performance and money metrics for the selected period (Kenya Shillings)."
        actions={
          <Button asChild size="sm">
            <Link href="/trips?action=create">
              <Plus className="mr-1.5 h-4 w-4" />
              <span>New Trip</span>
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 text-xs w-full sm:w-fit">
            {([
              ['30', 'Last 30 Days'],
              ['this_month', 'This Month'],
              ['90', 'Last 90 Days'],
              ['custom', 'Custom'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  preset === key ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-muted-foreground flex-1 sm:flex-none">
                <span className="block mb-1 font-medium">From</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => { setFromDate(e.target.value); setPreset('custom'); }}
                  className="h-9 w-full sm:w-auto rounded-md border border-input bg-card px-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground flex-1 sm:flex-none">
                <span className="block mb-1 font-medium">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={toIsoDate(today)}
                  onChange={(e) => { setToDate(e.target.value); setPreset('custom'); }}
                  className="h-9 w-full sm:w-auto rounded-md border border-input bg-card px-2 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="text-xs text-muted-foreground sm:pb-2">
              Showing <span className="font-semibold text-foreground">{formatDate(fromDate)}</span> – <span className="font-semibold text-foreground">{formatDate(toDate)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          Live financials Â· auto-refresh every 15s
          {dataUpdatedAt ? ` Â· updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-7 px-2 text-[11px]"
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Failed to load dashboard data.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Check connection/login and try refresh.'}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </Card>
      ) : null}

      {/* KPI Stat Cards Grid */}
      {isInitialLoad ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-3.5 sm:p-4 space-y-2">
              <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
              <Skeleton className="h-6 sm:h-8 w-20 sm:w-28" />
              <Skeleton className="h-2.5 sm:h-3 w-12 sm:w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          <StatCard
            title="Active Trips"
            value={stats?.kpis.active_trips ?? 0}
            subtitle="Currently on road"
            icon={<MapPin className="h-5 w-5" />}
          />
          <StatCard
            title="Trips This Period"
            value={stats?.kpis.trips_this_month ?? 0}
            subtitle="Completed or in transit"
            icon={<Truck className="h-5 w-5" />}
          />
          <StatCard
            title="Net Revenue"
            value={formatKES(stats?.kpis.revenue ?? 0)}
            subtitle={`Agreed ${formatKES(stats?.kpis.agreed_revenue ?? stats?.kpis.revenue ?? 0)} • CN ${formatKES(stats?.kpis.credit_note_amount ?? 0)}`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Direct Trip Costs"
            value={formatKES(stats?.kpis.direct_costs ?? 0)}
            subtitle="Approved direct costs"
            icon={<Receipt className="h-5 w-5" />}
            valueClassName="text-destructive font-semibold"
          />
          <StatCard
            title="Fleet Contribution"
            value={formatKES(stats?.kpis.contribution ?? 0)}
            subtitle={`${stats?.kpis.contribution_margin_pct ?? 0}% margin on net revenue`}
            icon={<Layers className="h-5 w-5" />}
            valueClassName="text-success font-semibold"
          />
          <StatCard
            title="Outstanding Invoices"
            value={formatKES(stats?.kpis.outstanding_invoices ?? 0)}
            subtitle={stats?.kpis.overdue_count ? `${stats.kpis.overdue_count} overdue` : 'Receivables due'}
            icon={<AlertTriangle className="h-5 w-5" />}
            valueClassName={stats?.kpis.overdue_count ? 'text-destructive font-semibold' : undefined}
          />
        </div>
      )}

      {/* Advancement C: Missing Entries Fleet Alert */}
      {missingSummary && missingSummary.total_open > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {missingSummary.total_open} Incomplete Fleet Entries Detected
              </p>
              <p className="text-xs text-muted-foreground">
                Incomplete fuel receipts, unbilled deliveries, or overdue documents affect profit sheets ({missingSummary.data_completeness_pct}% completeness).
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-500/40 hover:bg-amber-500/10 shrink-0">
            <Link href="/operations/missing-entries">
              <span>Fix Missing Entries</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Main Charts & Watchlist Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trips Per Truck Bar Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle>Trips Made Per Truck</CardTitle>
              <CardDescription>
                Completed hauls per truck for selected period
                {truckRows.length > 25 ? ` (showing top 25 of ${truckRows.length})` : ''}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/reports">
                <span>View Full Report</span>
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {isInitialLoad ? (
              <Skeleton className="h-72 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                No completed trips recorded in this period.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EE" />
                    <XAxis
                      dataKey="reg_number"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      tick={{ fill: '#5B6B7F', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: '#5B6B7F', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(238, 242, 246, 0.4)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                              <p className="font-mono font-bold text-foreground">{item.reg_number}</p>
                              <p className="text-muted-foreground">
                                Completed Trips: <span className="font-semibold text-foreground">{item.trips}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Net Revenue: <span className="font-mono text-foreground">{formatKES(item.revenue)}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Contribution:{' '}
                                <span className="font-mono font-semibold text-success">
                                  {formatKES(item.contribution)}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="trips" fill="#1E5AA8" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Watchlist / Alerts (1 col) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Fleet Alerts</CardTitle>
              <CardDescription>Documents, service & overdue notices</CardDescription>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold text-xs">
              {stats?.alerts?.length ?? 0}
            </span>
          </CardHeader>
          <CardContent className="pt-2">
            {isInitialLoad ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <AlertList alerts={stats?.alerts || []} limit={4} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top vs Bottom Trucks Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Top Trucks by Contribution</span>
            </CardTitle>
            <CardDescription>Highest contribution (net revenue âˆ’ approved direct costs) in period</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-80 overflow-auto">
              {(stats?.top_trucks || []).map((truck, idx) => (
                <div key={truck.truck_id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <Link href={`/trucks/${truck.truck_id}`} className="font-mono font-semibold text-sm hover:underline text-foreground">
                        {truck.reg_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{truck.make} {truck.model} â€¢ {truck.trips_made} trips</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <MoneyText amount={truck.contribution} variant="positive" size="base" />
                    <p className="text-[11px] text-muted-foreground tabular-nums">{truck.utilisation_pct}% utilisation</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Lowest Earning / Under-Utilised Trucks</span>
            </CardTitle>
            <CardDescription>Low/negative contribution or under-utilised; see full report for all trucks</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-80 overflow-auto">
              {(stats?.bottom_trucks || []).map((truck, idx) => (
                <div key={truck.truck_id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <Link href={`/trucks/${truck.truck_id}`} className="font-mono font-semibold text-sm hover:underline text-foreground">
                        {truck.reg_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{truck.make} {truck.model} â€¢ {truck.trips_made} trips</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <MoneyText amount={truck.contribution} size="base" />
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {truck.days_since_last_trip !== null ? `${truck.days_since_last_trip}d idle` : 'No recent trips'} â€¢ {truck.utilisation_pct}% util
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle>Recent Trips</CardTitle>
            <CardDescription>Latest dispatch activity across the transport network</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/trips">
              <span>View All Trips</span>
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Recent Trips Cards View */}
          <div className="block sm:hidden divide-y divide-border">
            {isInitialLoad ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))
            ) : !stats?.recent_trips?.length ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No recent trips recorded.
              </div>
            ) : (
              stats.recent_trips.map((trip) => (
                <div key={trip.id} className="p-4 space-y-2.5 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="font-mono font-bold text-sm text-primary hover:underline"
                    >
                      {trip.reference}
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={trip.status} />
                      <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Link href={`/trips/${trip.id}`} title="View details">
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {trip.origin} → {trip.destination}
                    </p>
                    {trip.cargo_description && (
                      <p className="text-xs text-muted-foreground truncate">{trip.cargo_description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Truck / Driver</span>
                      <span className="font-mono font-medium text-foreground">{trip.truck?.reg_number}</span>
                      <span className="text-muted-foreground block truncate">{trip.driver?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Customer</span>
                      <span className="font-medium text-foreground truncate block">{trip.customer?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground">Agreed Rate:</span>
                    <MoneyText amount={trip.agreed_rate} size="base" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Reference</th>
                  <th className="py-3 px-4 text-left font-medium">Route</th>
                  <th className="py-3 px-4 text-left font-medium">Truck & Driver</th>
                  <th className="py-3 px-4 text-left font-medium">Customer</th>
                  <th className="py-3 px-4 text-right font-medium">Rate (Revenue)</th>
                  <th className="py-3 px-4 text-center font-medium">Status</th>
                  <th className="py-3 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
            {isInitialLoad ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : stats?.recent_trips?.map((trip) => (
                  <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      <Link href={`/trips/${trip.id}`} className="hover:underline text-primary">
                        {trip.reference}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-foreground">{trip.origin} â†’ {trip.destination}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{trip.cargo_description}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-xs font-semibold text-foreground">{trip.truck?.reg_number}</p>
                      <p className="text-xs text-muted-foreground">{trip.driver?.name}</p>
                    </td>
                    <td className="py-3.5 px-4 text-foreground font-medium">
                      {trip.customer?.name}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <MoneyText amount={trip.agreed_rate} size="base" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={trip.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/trips/${trip.id}`}>
                          <span>Details</span>
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

