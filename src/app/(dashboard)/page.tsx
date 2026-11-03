'use client';

import React, { useState } from 'react';
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
  Calendar,
  Layers,
  ArrowRight,
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
import { formatKES, formatNumber, formatDate } from '@/lib/formatters';
import { DashboardStats } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<'30' | '90' | 'this_month'>('30');

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', range],
    queryFn: () => {
      let from = '';
      const to = '';
      const now = new Date();

      if (range === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        from = firstDay.toISOString().split('T')[0];
      } else if (range === '90') {
        const past = new Date(now.setDate(now.getDate() - 90));
        from = past.toISOString().split('T')[0];
      } else {
        const past = new Date(now.setDate(now.getDate() - 30));
        from = past.toISOString().split('T')[0];
      }

      return api.get<DashboardStats>('/dashboard/stats', { from, to });
    },
  });

  const chartData = stats?.trips_per_truck?.trucks?.map((t) => ({
    reg_number: t.reg_number,
    trips: t.trips_made,
    contribution: t.contribution,
    revenue: t.revenue,
    expenses: t.expenses,
  })) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Habari, ${user?.name ? user.name.split(' ')[0] : 'Transporter'}`}
        description="Here is your fleet performance, trip contribution, and compliance watchlist in Kenya Shillings."
        actions={
          <div className="flex items-center gap-2">
            {/* Date filter toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-sm text-xs">
              <button
                onClick={() => setRange('30')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  range === '30' ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setRange('this_month')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  range === 'this_month' ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setRange('90')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  range === '90' ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Last 90 Days
              </button>
            </div>

            <Button asChild size="sm">
              <Link href="/trips?action=create">
                <Plus className="mr-1.5 h-4 w-4" />
                <span>New Trip</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Stat Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
            title="Agreed Revenue"
            value={formatKES(stats?.kpis.revenue ?? 0)}
            subtitle="Total invoiced & billed"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Direct Trip Costs"
            value={formatKES(stats?.kpis.direct_costs ?? 0)}
            subtitle="Fuel, allowances, tolls, cess"
            icon={<Receipt className="h-5 w-5" />}
            valueClassName="text-destructive font-semibold"
          />
          <StatCard
            title="Fleet Contribution"
            value={formatKES(stats?.kpis.contribution ?? 0)}
            subtitle={`${stats?.kpis.contribution_margin_pct ?? 0}% margin (excl. overheads)`}
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

      {/* Main Charts & Watchlist Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trips Per Truck Bar Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Trips Made Per Truck</CardTitle>
              <CardDescription>
                Completed hauls per fleet vehicle for the selected period
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">
                <span>View Full Report</span>
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                No trips recorded in this period.
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
                      tick={{ fill: '#5B6B7F', fontSize: 12, fontFamily: 'monospace' }}
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
                                Revenue: <span className="font-mono text-foreground">{formatKES(item.revenue)}</span>
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
                    {/* Strict solid Harbor Blue fill without gradients */}
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
            {isLoading ? (
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
        {/* Top Trucks by Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Top Trucks by Contribution</span>
            </CardTitle>
            <CardDescription>Vehicles generating highest contribution margin</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats?.top_trucks?.map((truck, idx) => (
                <div key={truck.truck_id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <Link href={`/trucks/${truck.truck_id}`} className="font-mono font-semibold text-sm hover:underline text-foreground">
                        {truck.reg_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{truck.make} {truck.model} • {truck.trips_made} trips</p>
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

        {/* Bottom Trucks by Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Lowest Earning / Under-Utilised Trucks</span>
            </CardTitle>
            <CardDescription>Vehicles with lowest contribution or high idle days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats?.bottom_trucks?.map((truck, idx) => (
                <div key={truck.truck_id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <Link href={`/trucks/${truck.truck_id}`} className="font-mono font-semibold text-sm hover:underline text-foreground">
                        {truck.reg_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{truck.make} {truck.model} • {truck.trips_made} trips</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <MoneyText amount={truck.contribution} size="base" />
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {truck.days_since_last_trip !== null ? `${truck.days_since_last_trip}d idle` : 'No recent trips'}
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
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Recent Trips</CardTitle>
            <CardDescription>Latest dispatch activity across the transport network</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/trips">
              <span>View All Trips</span>
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                {isLoading ? (
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
                      <p className="font-medium text-foreground">{trip.origin} → {trip.destination}</p>
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

