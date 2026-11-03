'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Truck as TruckIcon,
  MapPin,
  Wrench,
  FileCheck,
  Fuel,
  TrendingUp,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatKm, formatDate, formatNumber } from '@/lib/formatters';
import { Truck } from '@/types';

interface TruckStatsResponse {
  truck_id: number;
  reg_number: string;
  make: string;
  model: string;
  status: string;
  capacity_tons: number;
  trips_made: number;
  total_km: number;
  revenue: number;
  expenses: number;
  contribution: number;
  utilisation_pct: number;
  days_since_last_trip: number | null;
  monthly_trend: {
    month: string;
    trips: number;
    km: number;
    revenue: number;
    expenses: number;
    contribution: number;
    utilisation_pct: number;
  }[];
}

export default function TruckDetailPage() {
  const params = useParams();
  const truckId = params.id as string;

  const { data: truckData, isLoading: isTruckLoading } = useQuery<{ data: Truck }>({
    queryKey: ['truck', truckId],
    queryFn: () => api.get<{ data: Truck }>(`/trucks/${truckId}`),
  });

  const { data: statsData, isLoading: isStatsLoading } = useQuery<{ data: TruckStatsResponse }>({
    queryKey: ['truck-stats', truckId],
    queryFn: () => api.get<{ data: TruckStatsResponse }>(`/trucks/${truckId}/stats`),
  });

  const truck = truckData?.data;
  const stats = statsData?.data;

  if (isTruckLoading || !truck) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${truck.reg_number} — ${truck.make} ${truck.model}`}
        description={`${truck.type} • ${truck.year} • Capacity: ${truck.capacity_tons} Tons • Odometer: ${formatKm(truck.odometer_km)}`}
        breadcrumbs={[
          { label: 'Fleet Trucks', href: '/trucks' },
          { label: truck.reg_number },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={truck.status} />
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Trips Made"
          value={stats?.trips_made ?? 0}
          subtitle={stats?.days_since_last_trip !== null ? `${stats?.days_since_last_trip} days since last trip` : 'No recent trips'}
          icon={<TruckIcon className="h-5 w-5" />}
        />
        <StatCard
          title="Total Distance Logged"
          value={formatKm(stats?.total_km ?? 0)}
          subtitle="From completed dispatch odometers"
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          title="Total Revenue (KES)"
          value={formatKES(stats?.revenue ?? 0)}
          subtitle="From customer billing"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Trip Contribution"
          value={formatKES(stats?.contribution ?? 0)}
          subtitle={`${stats?.utilisation_pct ?? 0}% Fleet Utilisation`}
          icon={<Layers className="h-5 w-5" />}
          valueClassName="text-success font-semibold"
        />
      </div>

      {/* 5 Tabs: Overview, Trips, Fuel, Maintenance, Documents */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips ({truck.trips?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({truck.maintenance_records?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Compliance ({truck.compliance_documents?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview with Trips-over-time Chart */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Trips & Contribution Trend (Last 6 Months)</CardTitle>
              <CardDescription>
                Monthly completed hauls and financial contribution for {truck.reg_number}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.monthly_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EE" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#5B6B7F', fontSize: 12 }}
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
                              <p className="font-bold text-foreground">{item.month}</p>
                              <p className="text-muted-foreground">
                                Completed Trips: <span className="font-semibold text-foreground">{item.trips}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Total Distance: <span className="font-mono text-foreground">{formatKm(item.km)}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Contribution:{' '}
                                <span className="font-mono font-semibold text-success">
                                  {formatKES(item.contribution)}
                                </span>
                              </p>
                              <p className="text-muted-foreground">
                                Utilisation: <span className="font-semibold text-foreground">{item.utilisation_pct}%</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="trips" fill="#1E5AA8" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Technical Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Registration Number</span>
                  <span className="font-mono font-bold text-foreground">{truck.reg_number}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Manufacturer / Make</span>
                  <span className="font-medium text-foreground">{truck.make}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium text-foreground">{truck.model}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Body Classification</span>
                  <span className="font-medium text-foreground">{truck.type}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Gross Payload Capacity</span>
                  <span className="font-bold text-foreground">{truck.capacity_tons} Tons</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Operating Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Current Status</span>
                  <StatusBadge status={truck.status} />
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Current Odometer</span>
                  <span className="font-mono font-semibold text-foreground">{formatKm(truck.odometer_km)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Total Lifetime Trips</span>
                  <span className="font-bold text-foreground tabular-nums">{truck.trips?.length ?? 0}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Days Since Last Trip</span>
                  <span className="font-medium text-foreground">
                    {stats?.days_since_last_trip !== null ? `${stats?.days_since_last_trip} days` : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Trips */}
        <TabsContent value="trips" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recorded Trips for {truck.reg_number}</CardTitle>
              <CardDescription>All dispatches linking driver, customer, rate and status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-left font-medium">Route</th>
                      <th className="py-3 px-4 text-left font-medium">Driver</th>
                      <th className="py-3 px-4 text-left font-medium">Customer</th>
                      <th className="py-3 px-4 text-right font-medium">Distance</th>
                      <th className="py-3 px-4 text-right font-medium">Agreed Rate</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {truck.trips?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">
                          No trips logged for this vehicle yet.
                        </td>
                      </tr>
                    ) : (
                      truck.trips?.map((trip) => (
                        <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-primary">
                            <Link href={`/trips/${trip.id}`} className="hover:underline">
                              {trip.reference}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground">{trip.origin} → {trip.destination}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(trip.start_date)}</p>
                          </td>
                          <td className="py-3 px-4 text-foreground">{trip.driver?.name}</td>
                          <td className="py-3 px-4 text-foreground">{trip.customer?.name}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                            {formatKm(trip.total_distance_km)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={trip.agreed_rate} size="base" />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={trip.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Fuel Logs */}
        <TabsContent value="fuel" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Fuel Consumption & Efficiency Logs</CardTitle>
              <CardDescription>
                Calculated km/L per diesel refill with 20% anomaly threshold detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl border border-info/30 bg-info-bg text-info-foreground text-xs leading-relaxed mb-4">
                <strong>Fuel Theft & Anomaly Rules:</strong> HaulTrack computes km per litre using odometer differences.
                Any refill more than 20% below the rolling average for {truck.reg_number} is flagged automatically.
              </div>
              <p className="text-xs text-muted-foreground">
                To inspect fuel entries across all trucks, see the{' '}
                <Link href="/reports" className="text-primary underline font-medium">
                  Fuel Efficiency Report
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Maintenance */}
        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Maintenance & Workshop Records</CardTitle>
                <CardDescription>Service history, tyre replacements, and upcoming schedule</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Date</th>
                      <th className="py-3 px-4 text-left font-medium">Service Type</th>
                      <th className="py-3 px-4 text-right font-medium">Odometer</th>
                      <th className="py-3 px-4 text-right font-medium">Cost</th>
                      <th className="py-3 px-4 text-left font-medium">Next Due</th>
                      <th className="py-3 px-4 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {truck.maintenance_records?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No workshop maintenance logged for this vehicle.
                        </td>
                      </tr>
                    ) : (
                      truck.maintenance_records?.map((record) => (
                        <tr key={record.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(record.date)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">{record.type}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                            {formatKm(record.odometer)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={record.cost} variant="negative" size="base" />
                          </td>
                          <td className="py-3 px-4 text-xs text-foreground">
                            {record.next_due_date ? formatDate(record.next_due_date) : ''}
                            {record.next_due_km ? ` • ${formatKm(record.next_due_km)}` : ''}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-xs">
                            {record.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Documents</CardTitle>
              <CardDescription>
                NTSA inspection, commercial insurance, speed governor certificates
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Document Type</th>
                      <th className="py-3 px-4 text-left font-medium">Certificate #</th>
                      <th className="py-3 px-4 text-left font-medium">Expiry Date</th>
                      <th className="py-3 px-4 text-left font-medium">Status / Days Left</th>
                      <th className="py-3 px-4 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {truck.compliance_documents?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
                          No compliance documents on file for this vehicle.
                        </td>
                      </tr>
                    ) : (
                      truck.compliance_documents?.map((doc) => {
                        const isExpired = doc.days_until_expiry < 0;
                        const isExpiringSoon = doc.days_until_expiry >= 0 && doc.days_until_expiry <= 30;

                        return (
                          <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-4 font-semibold capitalize text-foreground">
                              {doc.type.replace('_', ' ')}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-foreground">
                              {doc.document_number || '—'}
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(doc.expiry_date)}
                            </td>
                            <td className="py-3 px-4">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Expired {Math.abs(doc.days_until_expiry)}d ago
                                </span>
                              ) : isExpiringSoon ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
                                  <Clock className="h-3.5 w-3.5" />
                                  Expires in {doc.days_until_expiry} days
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                  <FileCheck className="h-3.5 w-3.5" />
                                  Valid ({doc.days_until_expiry} days)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">
                              {doc.notes || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
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

