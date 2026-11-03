'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  Truck,
  Fuel,
  TrendingUp,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatKm, formatDate } from '@/lib/formatters';
import { TripsPerTruckReport } from '@/types';

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // 1. Trips per truck report query (Must-have per prompt!)
  const { data: tripsPerTruckData, isLoading: isTptLoading } = useQuery<{ data: TripsPerTruckReport }>({
    queryKey: ['report-trips-per-truck', dateFrom, dateTo],
    queryFn: () => api.get<{ data: TripsPerTruckReport }>('/reports/trips-per-truck', { from: dateFrom, to: dateTo }),
  });

  // 2. Profitability query
  const { data: profData, isLoading: isProfLoading } = useQuery<{
    summary: {
      total_completed_trips: number;
      total_revenue: number;
      total_direct_costs: number;
      total_contribution: number;
      average_margin_pct: number;
      disclaimer?: string;
    };
    trips: {
      trip_id: number;
      reference: string;
      revenue: number;
      approved_direct_costs: number;
      contribution: number;
      contribution_margin_pct: number;
      distance_km: number;
      cost_per_km: number;
      contribution_per_km: number;
    }[];
  }>({
    queryKey: ['report-profitability', dateFrom, dateTo],
    queryFn: () => api.get('/reports/profitability', { from: dateFrom, to: dateTo }),
  });

  // 3. Fuel Efficiency query
  const { data: fuelData, isLoading: isFuelLoading } = useQuery<{
    summary: {
      total_fuel_entries: number;
      anomalies_detected: number;
      total_fuel_cost: number;
      total_litres: number;
      average_cost_per_litre: number;
    };
    entries: {
      expense_id: number;
      trip_reference: string;
      truck: string;
      date: string;
      amount: number;
      litres: number;
      odometer_at_fill: number;
      analysis: {
        km_per_litre: number;
        rolling_average_kml: number;
        is_anomaly: boolean;
        deviation_pct: number;
        warning?: string;
      };
    }[];
  }>({
    queryKey: ['report-fuel-efficiency', dateFrom, dateTo],
    queryFn: () => api.get('/reports/fuel-efficiency', { from: dateFrom, to: dateTo }),
  });

  // 4. Customer Ageing query
  const { data: agingData, isLoading: isAgingLoading } = useQuery<{
    total_receivables: number;
    portfolio_buckets: {
      current: number;
      days_1_30: number;
      days_31_60: number;
      days_61_90: number;
      days_90_plus: number;
    };
    customers: {
      id: number;
      name: string;
      phone: string;
      total_balance_owed: number;
      current: number;
      days_1_30: number;
      days_31_60: number;
      days_61_90: number;
      days_90_plus: number;
    }[];
  }>({
    queryKey: ['report-customer-aging'],
    queryFn: () => api.get('/reports/customer-aging'),
  });

  const exportCsv = (type: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/reports/export-csv?type=${type}&from=${dateFrom}&to=${dateTo}`;
    window.open(url, '_blank');
    toast.success('Downloading report CSV...');
  };

  const tptReport = tripsPerTruckData?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet & Operational Reports"
        description="Comprehensive analytics covering trips per truck, trip contribution, fuel anomaly audits, and customer debt ageing."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs bg-card border border-border p-1 rounded-lg">
              <span className="text-muted-foreground pl-2 font-medium">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-foreground border-0 text-xs focus:ring-0"
              />
              <span className="text-muted-foreground font-medium">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-foreground border-0 text-xs focus:ring-0 pr-2"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv('trips_per_truck')}
            >
              <Download className="mr-1.5 h-4 w-4" />
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="trips_per_truck" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1">
          <TabsTrigger value="trips_per_truck">Trips Per Truck (Must-Have)</TabsTrigger>
          <TabsTrigger value="profitability">Trip Contribution & P&L</TabsTrigger>
          <TabsTrigger value="fuel_efficiency">Fuel Audit & Anomalies</TabsTrigger>
          <TabsTrigger value="customer_aging">Customer Ageing</TabsTrigger>
        </TabsList>

        {/* Tab 1: TRIPS PER TRUCK (Must-Have per prompt) */}
        <TabsContent value="trips_per_truck" className="space-y-4 mt-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Fleet Size</span>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                {tptReport?.summary?.total_trucks ?? 0}
              </p>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Total Trips</span>
              <p className="text-xl font-bold text-primary mt-1 tabular-nums">
                {tptReport?.summary?.total_trips_made ?? 0}
              </p>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Distance</span>
              <p className="text-xl font-mono font-bold text-foreground mt-1 tabular-nums">
                {formatKm(tptReport?.summary?.total_km ?? 0)}
              </p>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Gross Revenue</span>
              <p className="text-xl font-mono font-bold text-foreground mt-1 tabular-nums">
                {formatKES(tptReport?.summary?.total_revenue ?? 0)}
              </p>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Direct Costs</span>
              <p className="text-xl font-mono font-bold text-destructive mt-1 tabular-nums">
                {formatKES(tptReport?.summary?.total_expenses ?? 0)}
              </p>
            </Card>
            <Card className="p-3.5">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Total Contribution</span>
              <p className="text-xl font-mono font-bold text-success mt-1 tabular-nums">
                {formatKES(tptReport?.summary?.total_contribution ?? 0)}
              </p>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle>Trips Completed per Truck</CardTitle>
                <CardDescription>
                  Tracking completed trips (delivered, invoiced, paid), utilization %, and idle days
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Reg Number</th>
                      <th className="py-3 px-4 text-left font-medium">Vehicle Specs</th>
                      <th className="py-3 px-4 text-center font-bold text-primary">Trips Made</th>
                      <th className="py-3 px-4 text-right font-medium">Total KM</th>
                      <th className="py-3 px-4 text-right font-medium">Revenue (KES)</th>
                      <th className="py-3 px-4 text-right font-medium">Direct Costs</th>
                      <th className="py-3 px-4 text-right font-semibold text-success">Contribution</th>
                      <th className="py-3 px-4 text-center font-medium">Utilisation %</th>
                      <th className="py-3 px-4 text-right font-medium">Days Idle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isTptLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="p-4">
                            <Skeleton className="h-6 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : tptReport?.trucks?.map((truck) => (
                      <tr key={truck.truck_id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                          <Link href={`/trucks/${truck.truck_id}`} className="hover:underline">
                            {truck.reg_number}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-foreground text-xs">{truck.make} {truck.model}</p>
                          <p className="text-[11px] text-muted-foreground">{truck.capacity_tons} Tons</p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                            {truck.trips_made} completed
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                          {formatKm(truck.total_km)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">
                          {formatKES(truck.revenue)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-destructive">
                          {formatKES(truck.expenses)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-success">
                          {formatKES(truck.contribution)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {truck.utilisation_pct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                          {truck.days_since_last_trip !== null ? `${truck.days_since_last_trip} days` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Profitability / Contribution */}
        <TabsContent value="profitability" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Trip Contribution Breakdown</CardTitle>
              <CardDescription>
                Contribution = Agreed Revenue minus direct approved haulage costs. Shared fleet overheads are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-right font-medium">Distance</th>
                      <th className="py-3 px-4 text-right font-medium">Revenue (KES)</th>
                      <th className="py-3 px-4 text-right font-medium">Direct Costs</th>
                      <th className="py-3 px-4 text-right font-semibold text-success">Contribution</th>
                      <th className="py-3 px-4 text-right font-medium">Margin %</th>
                      <th className="py-3 px-4 text-right font-medium">KES / KM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {profData?.trips?.map((t) => (
                      <tr key={t.trip_id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          <Link href={`/trips/${t.trip_id}`} className="hover:underline">
                            {t.reference}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                          {formatKm(t.distance_km)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {formatKES(t.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-destructive">
                          {formatKES(t.approved_direct_costs)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-success">
                          {formatKES(t.contribution)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums font-semibold text-foreground">
                          {t.contribution_margin_pct}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {t.contribution_per_km} KSh/km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Fuel Efficiency & Anomalies */}
        <TabsContent value="fuel_efficiency" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <span className="text-xs font-medium uppercase text-muted-foreground">Fuel Refills Logged</span>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fuelData?.summary?.total_fuel_entries ?? 0}</p>
            </Card>
            <Card className="p-4 border-destructive/30">
              <span className="text-xs font-medium uppercase text-destructive">Anomalies Detected (&gt;20% Deviation)</span>
              <p className="text-2xl font-bold text-destructive mt-1 tabular-nums">{fuelData?.summary?.anomalies_detected ?? 0}</p>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-medium uppercase text-muted-foreground">Total Diesel Expense</span>
              <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{formatKES(fuelData?.summary?.total_fuel_cost ?? 0)}</p>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Refill Log & Anomaly Detection Trail</CardTitle>
              <CardDescription>
                Compares recorded fuel volume and odometer against the truck&apos;s rolling average km/L
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Date</th>
                      <th className="py-3 px-4 text-left font-medium">Truck</th>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-right font-medium">Litres</th>
                      <th className="py-3 px-4 text-right font-medium">Refill Cost</th>
                      <th className="py-3 px-4 text-center font-medium">Km / Litre</th>
                      <th className="py-3 px-4 text-center font-medium">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fuelData?.entries?.map((f) => (
                      <tr key={f.expense_id} className={`hover:bg-muted/40 transition-colors ${f.analysis?.is_anomaly ? 'bg-destructive-bg/30' : ''}`}>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(f.date)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {f.truck}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-primary">
                          {f.trip_reference}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                          {f.litres} L
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                          {formatKES(f.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-sm">
                          {f.analysis?.km_per_litre ? `${f.analysis.km_per_litre} km/L` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {f.analysis?.is_anomaly ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive-bg text-destructive border border-destructive/30">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{f.analysis.deviation_pct}% anomaly</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success border border-success/30">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Customer Ageing */}
        <TabsContent value="customer_aging" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Customer Receivables Ageing Portfolio</CardTitle>
              <CardDescription>
                Outstanding invoices categorized by aging brackets past payment terms
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Customer</th>
                      <th className="py-3 px-4 text-right font-bold text-destructive">Total Owed</th>
                      <th className="py-3 px-4 text-right font-medium">Current</th>
                      <th className="py-3 px-4 text-right font-medium">1–30 Days</th>
                      <th className="py-3 px-4 text-right font-medium">31–60 Days</th>
                      <th className="py-3 px-4 text-right font-medium text-destructive">61–90 Days+</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {agingData?.customers?.map((cust) => (
                      <tr key={cust.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {cust.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-destructive">
                          {formatKES(cust.total_balance_owed)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {cust.current ? formatKES(cust.current) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {cust.days_1_30 ? formatKES(cust.days_1_30) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-warning font-medium">
                          {cust.days_31_60 ? formatKES(cust.days_31_60) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-destructive font-bold">
                          {cust.days_61_90 || cust.days_90_plus
                            ? formatKES(cust.days_61_90 + cust.days_90_plus)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

