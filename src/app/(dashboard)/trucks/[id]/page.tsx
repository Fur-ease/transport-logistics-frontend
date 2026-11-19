'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Truck as TruckIcon,
  Container,
  Link2,
  Unlink,
  MapPin,
  Wrench,
  FileCheck,
  Fuel,
  TrendingUp,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Receipt,
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
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { CouplingDialog } from '@/components/fleet/CouplingDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatKm, formatDate, formatNumber } from '@/lib/formatters';
import { Truck, Trip, TruckTrailerAssignment } from '@/types';

interface TruckTripsResponse {
  data: Trip[];
  meta: PagerMeta;
  stats: {
    all: number;
    planned: number;
    in_transit: number;
    delivered: number;
    invoiced: number;
    paid: number;
    cancelled: number;
  };
}

interface TruckCouplingsResponse {
  data: TruckTrailerAssignment[];
  meta: PagerMeta;
  stats: {
    all: number;
    active: number;
    ended: number;
  };
}

interface PagerMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

function Pager({
  meta,
  onPage,
  perPage,
  onPerPage,
  noun,
}: {
  meta: PagerMeta;
  onPage: (page: number) => void;
  perPage: number;
  onPerPage: (perPage: number) => void;
  noun: string;
}) {
  if (meta.total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{meta.from ?? 0}</span>â€“
        <span className="font-semibold text-foreground">{meta.to ?? 0}</span> of{' '}
        <span className="font-semibold text-foreground">{meta.total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Rows</label>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="h-8 px-2 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {[10, 15, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={meta.current_page <= 1}
          onClick={() => onPage(Math.max(1, meta.current_page - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Page <span className="font-semibold text-foreground">{meta.current_page}</span> of{' '}
          <span className="font-semibold text-foreground">{meta.last_page}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPage(Math.min(meta.last_page, meta.current_page + 1))}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const tripStatusChips = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

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
  const [coupleOpen, setCoupleOpen] = useState(false);
  const [uncoupleOpen, setUncoupleOpen] = useState(false);

  const [tripStatus, setTripStatus] = useState('all');
  const [tripSearchInput, setTripSearchInput] = useState('');
  const [tripSearch, setTripSearch] = useState('');
  const [tripFrom, setTripFrom] = useState('');
  const [tripTo, setTripTo] = useState('');
  const [tripSort, setTripSort] = useState('start_date');
  const [tripDirection, setTripDirection] = useState<'asc' | 'desc'>('desc');
  const [tripPage, setTripPage] = useState(1);
  const [tripPerPage, setTripPerPage] = useState(15);

  const [couplingStatus, setCouplingStatus] = useState('all');
  const [couplingSearchInput, setCouplingSearchInput] = useState('');
  const [couplingSearch, setCouplingSearch] = useState('');
  const [couplingPage, setCouplingPage] = useState(1);
  const [couplingPerPage, setCouplingPerPage] = useState(10);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTripSearch(tripSearchInput);
      setTripPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [tripSearchInput]);

  React.useEffect(() => {
    setTripPage(1);
  }, [tripStatus, tripFrom, tripTo, tripSort, tripDirection, tripPerPage]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCouplingSearch(couplingSearchInput);
      setCouplingPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [couplingSearchInput]);

  React.useEffect(() => {
    setCouplingPage(1);
  }, [couplingStatus, couplingPerPage]);

  const { data: truckData, isLoading: isTruckLoading } = useQuery<{ data: Truck }>({
    queryKey: ['truck', truckId],
    queryFn: () => api.get<{ data: Truck }>(`/trucks/${truckId}`),
  });

  const { data: statsData, isLoading: isStatsLoading } = useQuery<{ data: TruckStatsResponse }>({
    queryKey: ['truck-stats', truckId],
    queryFn: () => api.get<{ data: TruckStatsResponse }>(`/trucks/${truckId}/stats`),
  });

  const { data: tripsData, isLoading: isTripsLoading } = useQuery<TruckTripsResponse>({
    queryKey: [
      'truck-trips',
      truckId,
      tripStatus,
      tripSearch,
      tripFrom,
      tripTo,
      tripSort,
      tripDirection,
      tripPage,
      tripPerPage,
    ],
    queryFn: () =>
      api.get<TruckTripsResponse>(`/trucks/${truckId}/trips`, {
        status: tripStatus,
        search: tripSearch,
        from: tripFrom || undefined,
        to: tripTo || undefined,
        sort: tripSort,
        direction: tripDirection,
        page: tripPage,
        per_page: tripPerPage,
      }),
    refetchInterval: 30000,
  });

  const { data: couplingsData, isLoading: isCouplingsLoading } = useQuery<TruckCouplingsResponse>({
    queryKey: ['truck-couplings', truckId, couplingStatus, couplingSearch, couplingPage, couplingPerPage],
    queryFn: () =>
      api.get<TruckCouplingsResponse>(`/trucks/${truckId}/couplings`, {
        status: couplingStatus,
        search: couplingSearch,
        page: couplingPage,
        per_page: couplingPerPage,
      }),
    refetchInterval: 30000,
  });

  const truck = truckData?.data;
  const stats = statsData?.data;
  const truckTrips = tripsData?.data ?? [];
  const tripStats = tripsData?.stats;
  const couplings = couplingsData?.data ?? [];
  const couplingStats = couplingsData?.stats;

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
        title={`${truck.reg_number} - ${truck.make} ${truck.model}`}
        description={`${truck.type} | ${truck.year} | Capacity: ${truck.capacity_tons} Tons | Odometer: ${formatKm(truck.odometer_km)}`}
        backHref="/trucks"
        backLabel="Back to fleet"
        breadcrumbs={[
          { label: 'Fleet & Trailers', href: '/trucks' },
          { label: truck.reg_number },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={truck.status} />
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          title="Total Expenses"
          value={formatKES(stats?.expenses ?? 0)}
          subtitle="Approved trip expenses"
          icon={<Receipt className="h-5 w-5" />}
          valueClassName="text-destructive font-semibold"
        />
        <StatCard
          title="Trip Contribution"
          value={formatKES(stats?.contribution ?? 0)}
          subtitle={`${stats?.utilisation_pct ?? 0}% Fleet Utilisation`}
          icon={<Layers className="h-5 w-5" />}
          valueClassName="text-success font-semibold"
        />
      </div>

      {/* 6 Tabs: Overview, Trips, Fuel, Maintenance, Documents, History */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 h-auto p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips ({truck.trips_count ?? 0})</TabsTrigger>
          <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({truck.maintenance_records?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Compliance ({truck.compliance_documents?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
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
                  <span className="font-bold text-foreground tabular-nums">{truck.trips_count ?? 0}</span>
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

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Current Haulage Combination</CardTitle>
                <CardDescription>Active truck head and trailer coupling</CardDescription>
              </div>
              {truck.current_assignment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUncoupleOpen(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  Uncouple
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {truck.current_assignment?.trailer ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <Container className="h-9 w-9 text-primary" />
                    <div>
                      <p className="font-mono text-lg font-bold text-foreground">
                        {truck.current_assignment.trailer.reg_number}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {truck.current_assignment.trailer.type.replace('_', ' ')} •{' '}
                        {truck.current_assignment.trailer.capacity_tons} tons
                        {truck.current_assignment.trailer.make
                          ? ` • ${truck.current_assignment.trailer.make} ${truck.current_assignment.trailer.model || ''}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Coupled:{' '}
                      <span className="font-medium text-foreground">
                        {formatDate(truck.current_assignment.coupled_at)}
                      </span>
                    </p>
                    <p>
                      Odometer:{' '}
                      <span className="font-mono text-foreground">
                        {formatKm(truck.current_assignment.odometer_at_couple ?? 0)}
                      </span>
                    </p>
                    {truck.current_assignment.couple_notes && (
                      <p>Notes: {truck.current_assignment.couple_notes}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-dashed border-border bg-secondary/40">
                  <p className="text-xs text-muted-foreground">
                    This truck head is not coupled to any trailer. Couple an available trailer before
                    dispatching a haulage trip.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setCoupleOpen(true)}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    Couple Trailer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Trips */}
        <TabsContent value="trips" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recorded Trips for {truck.reg_number}</CardTitle>
              <CardDescription>All dispatches linking driver, customer, rate and status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-3 space-y-3 border-b border-border">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ref, route, driver, customer, trailer..."
                      value={tripSearchInput}
                      onChange={(e) => setTripSearchInput(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={tripFrom}
                      onChange={(e) => setTripFrom(e.target.value)}
                      className="h-9 text-xs w-36"
                      title="Start date from"
                    />
                    <Input
                      type="date"
                      value={tripTo}
                      onChange={(e) => setTripTo(e.target.value)}
                      className="h-9 text-xs w-36"
                      title="Start date to"
                    />
                    <select
                      value={tripSort}
                      onChange={(e) => setTripSort(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="start_date">Start date</option>
                      <option value="end_date">End date</option>
                      <option value="agreed_rate">Agreed rate</option>
                      <option value="reference">Reference</option>
                      <option value="status">Status</option>
                    </select>
                    <select
                      value={tripDirection}
                      onChange={(e) => setTripDirection(e.target.value as 'asc' | 'desc')}
                      className="h-9 px-2.5 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="desc">Newest first</option>
                      <option value="asc">Oldest first</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        setTripStatus('all');
                        setTripSearchInput('');
                        setTripSearch('');
                        setTripFrom('');
                        setTripTo('');
                        setTripSort('start_date');
                        setTripDirection('desc');
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  {tripStatusChips.map((st) => {
                    const count = tripStats?.[st.key as keyof NonNullable<typeof tripStats>];
                    return (
                      <button
                        key={st.key}
                        onClick={() => setTripStatus(st.key)}
                        className={`px-3 py-1.5 rounded-full font-medium capitalize transition-colors border cursor-pointer whitespace-nowrap ${
                          tripStatus === st.key
                            ? 'bg-primary text-white border-primary font-semibold shadow-sm'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {st.label}
                        {typeof count === 'number' && (
                          <span
                            className={`ml-1.5 tabular-nums ${
                              tripStatus === st.key ? 'text-white/80' : 'text-muted-foreground'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-left font-medium">Route</th>
                      <th className="py-3 px-4 text-left font-medium">Trailer</th>
                      <th className="py-3 px-4 text-left font-medium">Driver</th>
                      <th className="py-3 px-4 text-left font-medium">Customer</th>
                      <th className="py-3 px-4 text-right font-medium">Distance</th>
                      <th className="py-3 px-4 text-right font-medium">Agreed Rate</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isTripsLoading ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">
                          Loading tripsâ€¦
                        </td>
                      </tr>
                    ) : truckTrips.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">
                          No trips match the current filters for this vehicle.
                        </td>
                      </tr>
                    ) : (
                      truckTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-primary">
                            <Link href={`/trips/${trip.id}`} className="hover:underline">
                              {trip.reference}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground">{trip.origin} â†’ {trip.destination}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(trip.start_date)}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs text-foreground">
                              {trip.trailer?.reg_number ?? 'â€”'}
                            </span>
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
              {tripsData?.meta && (
                <Pager
                  meta={tripsData.meta}
                  onPage={setTripPage}
                  perPage={tripPerPage}
                  onPerPage={setTripPerPage}
                  noun="trips"
                />
              )}
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
                            {record.notes || 'â€”'}
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
                              {doc.document_number || 'â€”'}
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
                              {doc.notes || 'â€”'}
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

        {/* Tab 6: History & Audit Timeline */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trailer Coupling History</CardTitle>
              <CardDescription>
                Every trailer pulled by {truck.reg_number}, including coupling odometer readings and
                hand-over reasons.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  {[
                    { key: 'all', label: 'All', count: couplingStats?.all },
                    { key: 'active', label: 'Active', count: couplingStats?.active },
                    { key: 'ended', label: 'Ended', count: couplingStats?.ended },
                  ].map((st) => (
                    <button
                      key={st.key}
                      onClick={() => setCouplingStatus(st.key)}
                      className={`px-3 py-1.5 rounded-full font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                        couplingStatus === st.key
                          ? 'bg-primary text-white border-primary font-semibold shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {st.label}
                      {typeof st.count === 'number' && (
                        <span
                          className={`ml-1.5 tabular-nums ${
                            couplingStatus === st.key ? 'text-white/80' : 'text-muted-foreground'
                          }`}
                        >
                          {st.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search trailer plate..."
                    value={couplingSearchInput}
                    onChange={(e) => setCouplingSearchInput(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trailer</th>
                      <th className="py-3 px-4 text-left font-medium">Coupled</th>
                      <th className="py-3 px-4 text-left font-medium">Uncoupled</th>
                      <th className="py-3 px-4 text-right font-medium">Odometer</th>
                      <th className="py-3 px-4 text-left font-medium">Reason / Notes</th>
                      <th className="py-3 px-4 text-left font-medium">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isCouplingsLoading ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          Loading coupling historyâ€¦
                        </td>
                      </tr>
                    ) : couplings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No coupling records match the current filters for this truck head.
                        </td>
                      </tr>
                    ) : (
                      couplings.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Container className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono text-xs font-bold text-foreground">
                                {assignment.trailer?.reg_number ?? `#${assignment.trailer_id}`}
                              </span>
                              {!assignment.uncoupled_at && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(assignment.coupled_at)}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {assignment.uncoupled_at ? formatDate(assignment.uncoupled_at) : 'â€”'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                            {formatKm(assignment.odometer_at_couple ?? 0)}
                            {assignment.odometer_at_uncouple
                              ? ` â†’ ${formatKm(assignment.odometer_at_uncouple)}`
                              : ''}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                            {assignment.uncouple_reason || assignment.couple_notes || 'â€”'}
                          </td>
                          <td className="py-3 px-4 text-xs text-foreground">
                            {assignment.uncoupled_by_user?.name ||
                              assignment.coupled_by_user?.name ||
                              'â€”'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {couplingsData?.meta && (
                <Pager
                  meta={couplingsData.meta}
                  onPage={setCouplingPage}
                  perPage={couplingPerPage}
                  onPerPage={setCouplingPerPage}
                  noun="couplings"
                />
              )}
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-base">Truck Change & Audit History</CardTitle>
              <CardDescription>
                Detailed field-level audit trail of status, odometer, and specification edits.
              </CardDescription>
            </CardHeader>
            <HistoryTimeline auditableType="truck" auditableId={truck.id} />
          </Card>
        </TabsContent>
      </Tabs>

      <CouplingDialog
        mode="couple"
        truck={truck}
        open={coupleOpen}
        onOpenChange={setCoupleOpen}
      />
      <CouplingDialog
        mode="uncouple"
        truck={truck}
        open={uncoupleOpen}
        onOpenChange={setUncoupleOpen}
      />
    </div>
  );
}

