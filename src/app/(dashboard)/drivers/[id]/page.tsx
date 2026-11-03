'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  MapPin,
  CreditCard,
  FileCheck,
  Phone,
  Shield,
  Clock,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatKES, formatKm, formatDate } from '@/lib/formatters';
import { Driver } from '@/types';

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params.id as string;

  const { data, isLoading } = useQuery<{ data: Driver }>({
    queryKey: ['driver', driverId],
    queryFn: () => api.get<{ data: Driver }>(`/drivers/${driverId}`),
  });

  const driver = data?.data;

  if (isLoading || !driver) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isLicenceExpiringSoon = () => {
    const diffDays = Math.ceil(
      (new Date(driver.licence_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays <= 30;
  };

  const expiring = isLicenceExpiringSoon();

  return (
    <div className="space-y-6">
      <PageHeader
        title={driver.name}
        description={`Licence: ${driver.licence_no} • Phone: ${driver.phone}`}
        breadcrumbs={[
          { label: 'Drivers Roster', href: '/drivers' },
          { label: driver.name },
        ]}
        actions={<StatusBadge status={driver.status} />}
      />

      {/* Summary Profile Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Driving Licence (NTSA)</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-base font-bold text-foreground">{driver.licence_no}</span>
            {expiring ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-foreground border border-warning/30">
                <AlertTriangle className="h-3 w-3" />
                <span>Expires {formatDate(driver.licence_expiry)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success-foreground border border-success/30">
                <FileCheck className="h-3 w-3" />
                <span>Valid to {formatDate(driver.licence_expiry)}</span>
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Trips Logged</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {driver.trips?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Assigned dispatches</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase font-medium text-muted-foreground">Advances Accounted</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
            {driver.advances?.length ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Recorded cash settlements</p>
        </Card>
      </div>

      {/* Tabs: Trips & Advances */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs h-10">
          <TabsTrigger value="trips">Trips Made ({driver.trips?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="advances">Advances Trail ({driver.advances?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Trips Made Tab */}
        <TabsContent value="trips" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Completed & Active Trips for {driver.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-left font-medium">Route</th>
                      <th className="py-3 px-4 text-left font-medium">Truck</th>
                      <th className="py-3 px-4 text-left font-medium">Customer</th>
                      <th className="py-3 px-4 text-right font-medium">Rate (Revenue)</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driver.trips?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No trips assigned yet.
                        </td>
                      </tr>
                    ) : (
                      driver.trips?.map((trip) => (
                        <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-primary">
                            <Link href={`/trips/${trip.id}`} className="hover:underline">
                              {trip.reference}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-foreground">{trip.origin} → {trip.destination}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(trip.start_date)}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                            {trip.truck?.reg_number}
                          </td>
                          <td className="py-3 px-4 text-foreground">{trip.customer?.name}</td>
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

        {/* Advances History Tab */}
        <TabsContent value="advances" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Advance Settlement Trail</CardTitle>
              <CardDescription>
                Audit history of allowances, accepted receipts, and cash returned
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Trip Ref</th>
                      <th className="py-3 px-4 text-right font-medium">1. Advance Given</th>
                      <th className="py-3 px-4 text-right font-medium">2. Expenses Accepted</th>
                      <th className="py-3 px-4 text-right font-medium">3. Amount Returned</th>
                      <th className="py-3 px-4 text-right font-medium">Balance Due</th>
                      <th className="py-3 px-4 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driver.advances?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                          No cash advances recorded for this driver.
                        </td>
                      </tr>
                    ) : (
                      driver.advances?.map((adv) => (
                        <tr key={adv.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-bold text-primary">
                            {adv.trip_reference || 'Trip'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.amount_given} size="base" />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.expenses_accepted} variant="positive" size="base" />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <MoneyText amount={adv.amount_returned} size="base" />
                          </td>
                          <td className="py-3 px-4 text-right font-bold">
                            <MoneyText
                              amount={adv.balance_remaining}
                              variant={adv.balance_remaining > 0 ? 'negative' : 'positive'}
                              size="base"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={adv.status} />
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
      </Tabs>
    </div>
  );
}

