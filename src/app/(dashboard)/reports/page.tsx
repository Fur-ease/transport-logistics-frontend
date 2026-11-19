'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Download, Truck, Fuel, TrendingUp, AlertTriangle, Building2,
  Search, RefreshCw, SlidersHorizontal, ChevronLeft, ChevronRight, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { MoneyText } from '@/components/shared/MoneyText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { LIVE_REFETCH_MS } from '@/lib/liveSync';
import { formatKES, formatKm, formatDate } from '@/lib/formatters';
import { TripsPerTruckReport } from '@/types';

function toIso(d: Date){ return d.toISOString().split('T')[0]; }
function paginate<T>(items: T[], page: number, perPage: number){
  const total = items.length; const last = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1,page), last);
  const start = (p-1)*perPage;
  return { rows: items.slice(start, start+perPage), meta: { total, page: p, last_page: last, from: total? start+1:0, to: Math.min(start+perPage,total) } };
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<'30'|'90'|'this_month'|'custom'>('90');
  const [dateFrom, setDateFrom] = useState(() => { const d=new Date(); d.setDate(d.getDate()-89); return toIso(d); });
  const [dateTo, setDateTo] = useState(() => toIso(new Date()));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [tab, setTab] = useState('trips_per_truck');

  React.useEffect(() => {
    if (preset === 'custom') return;
    const now = new Date();
    if (preset === 'this_month') { setDateFrom(toIso(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(toIso(now)); }
    else if (preset === '30') { const d=new Date(); d.setDate(d.getDate()-29); setDateFrom(toIso(d)); setDateTo(toIso(now)); }
    else { const d=new Date(); d.setDate(d.getDate()-89); setDateFrom(toIso(d)); setDateTo(toIso(now)); }
  }, [preset]);
  React.useEffect(() => { setPage(1); }, [search, tab, dateFrom, dateTo, perPage]);

  const { data: tptRes, isLoading: tptLoading, isFetching: tptFetching, refetch: refetchTpt, dataUpdatedAt } =
    useQuery<{ data: TripsPerTruckReport }>({ queryKey:['report-trips-per-truck',dateFrom,dateTo], queryFn: () => api.get('/reports/trips-per-truck',{from:dateFrom,to:dateTo}), refetchInterval: LIVE_REFETCH_MS });
  const { data: profData, isLoading: profLoading } = useQuery<any>({ queryKey:['report-profitability',dateFrom,dateTo], queryFn: () => api.get('/reports/profitability',{from:dateFrom,to:dateTo}), refetchInterval: LIVE_REFETCH_MS });
  const { data: fuelData, isLoading: fuelLoading } = useQuery<any>({ queryKey:['report-fuel-efficiency',dateFrom,dateTo], queryFn: () => api.get('/reports/fuel-efficiency',{from:dateFrom,to:dateTo}), refetchInterval: LIVE_REFETCH_MS });
  const { data: agingData, isLoading: agingLoading } = useQuery<any>({ queryKey:['report-customer-aging'], queryFn: () => api.get('/reports/customer-aging'), refetchInterval: LIVE_REFETCH_MS });

  const tpt = tptRes?.data;
  const q = search.toLowerCase().trim();

  const tptRows = useMemo(() => (tpt?.trucks || []).filter((r: any) => !q || `${r.reg_number} ${r.make} ${r.model}`.toLowerCase().includes(q)), [tpt, q]);
  const profRows = useMemo(() => (profData?.trips || []).filter((r: any) => !q || `${r.reference} ${r.trip_id}`.toLowerCase().includes(q)), [profData, q]);
  const fuelRows = useMemo(() => (fuelData?.entries || []).filter((r: any) => !q || `${r.trip_reference} ${r.truck}`.toLowerCase().includes(q)), [fuelData, q]);
  const agingRows = useMemo(() => (agingData?.customers || []).filter((r: any) => !q || `${r.name} ${r.phone||''}`.toLowerCase().includes(q)), [agingData, q]);

  const currentRows = tab==='trips_per_truck'?tptRows:tab==='profitability'?profRows:tab==='fuel_efficiency'?fuelRows:agingRows;
  const paged = paginate(currentRows, page, perPage);

  const exportCsv = (type: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const params = new URLSearchParams({ type, from: dateFrom, to: dateTo });
    window.open(`${base}/reports/export-csv?${params.toString()}`, '_blank');
    toast.success('Downloading report CSV...');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet & Operational Reports"
        description="Real-time analytics for trips, contribution, fuel audit and receivables ageing. Period applies to date-based reports."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv('trips_per_truck')}><Download className="mr-1.5 h-4 w-4" />Trips/Truck CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv('trips')}><Download className="mr-1.5 h-4 w-4" />Trips CSV</Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-3 flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 text-xs w-fit">
            {([['30','Last 30 Days'],['90','Last 90 Days'],['this_month','This Month'],['custom','Custom']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setPreset(k)} className={`px-3 py-1.5 rounded-md font-medium ${preset===k?'bg-primary text-white':'text-muted-foreground hover:text-foreground'}`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground"><span className="block mb-1 font-medium">From</span><input type="date" value={dateFrom} max={dateTo} onChange={e=>{setDateFrom(e.target.value);setPreset('custom');}} className="h-9 rounded-md border border-input bg-card px-2 text-sm" /></label>
            <label className="text-xs text-muted-foreground"><span className="block mb-1 font-medium">To</span><input type="date" value={dateTo} min={dateFrom} onChange={e=>{setDateTo(e.target.value);setPreset('custom');}} className="h-9 rounded-md border border-input bg-card px-2 text-sm" /></label>
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search in current tab..." className="pl-8 h-9 w-56 text-xs" /></div>
            <Button variant="ghost" size="sm" onClick={() => { refetchTpt(); }} disabled={tptFetching} className="h-9 text-xs"><RefreshCw className={`mr-1 h-3.5 w-3.5 ${tptFetching?'animate-spin':''}`} />Refresh</Button>
            <span className="text-[11px] text-muted-foreground pb-2">Live auto-refresh 15s{dataUpdatedAt?` • ${new Date(dataUpdatedAt).toLocaleTimeString()}`:''}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1">
          <TabsTrigger value="trips_per_truck">Trips Per Truck</TabsTrigger>
          <TabsTrigger value="profitability">Contribution & P&L</TabsTrigger>
          <TabsTrigger value="fuel_efficiency">Fuel Audit</TabsTrigger>
          <TabsTrigger value="customer_aging">Customer Ageing</TabsTrigger>
        </TabsList>

        <TabsContent value="trips_per_truck" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Fleet</span><p className="text-xl font-bold mt-1">{tpt?.summary?.total_trucks ?? 0}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Trips</span><p className="text-xl font-bold text-primary mt-1">{tpt?.summary?.total_trips_made ?? 0}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Distance</span><p className="text-xl font-mono font-bold mt-1">{formatKm(tpt?.summary?.total_km ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Revenue</span><p className="text-xl font-mono font-bold mt-1">{formatKES(tpt?.summary?.total_revenue ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Direct Costs</span><p className="text-xl font-mono font-bold text-destructive mt-1">{formatKES(tpt?.summary?.total_expenses ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Contribution</span><p className="text-xl font-mono font-bold text-success mt-1">{formatKES(tpt?.summary?.total_contribution ?? 0)}</p></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle>Trips Completed per Truck</CardTitle><CardDescription>Completed in period (delivered/invoiced/paid), contribution from approved direct expenses</CardDescription></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border"><tr>
              <th className="py-3 px-4 text-left">Reg</th><th className="py-3 px-4 text-left">Vehicle</th><th className="py-3 px-4 text-center font-bold text-primary">Trips</th><th className="py-3 px-4 text-right">KM</th><th className="py-3 px-4 text-right">Revenue</th><th className="py-3 px-4 text-right">Direct Costs</th><th className="py-3 px-4 text-right font-semibold text-success">Contribution</th><th className="py-3 px-4 text-center">Util %</th><th className="py-3 px-4 text-right">Idle</th>
            </tr></thead><tbody className="divide-y divide-border">
              {tptLoading ? [...Array(6)].map((_,i)=><tr key={i}><td colSpan={9} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>) :
              paged.rows.map((truck:any)=>(
                <tr key={truck.truck_id} className="hover:bg-muted/40"><td className="py-3.5 px-4 font-mono font-bold text-primary"><Link href={`/trucks/${truck.truck_id}`} className="hover:underline">{truck.reg_number}</Link></td>
                  <td className="py-3.5 px-4"><p className="font-semibold text-xs">{truck.make} {truck.model}</p><p className="text-[11px] text-muted-foreground">{truck.capacity_tons}T • {truck.status}</p></td>
                  <td className="py-3.5 px-4 text-center"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">{truck.trips_made}</span></td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">{formatKm(truck.total_km)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs">{formatKES(truck.revenue)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-destructive">{formatKES(truck.expenses)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-success">{formatKES(truck.contribution)}</td>
                  <td className="py-3.5 px-4 text-center text-xs font-semibold">{truck.utilisation_pct}%</td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">{truck.days_since_last_trip!=null?`${truck.days_since_last_trip}d`:'N/A'}</td></tr>
              ))}
            </tbody></table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="profitability" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Completed Trips</span><p className="text-xl font-bold mt-1">{profData?.summary?.total_completed_trips ?? 0}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Revenue</span><p className="text-xl font-mono font-bold mt-1">{formatKES(profData?.summary?.total_revenue ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Direct Costs</span><p className="text-xl font-mono font-bold text-destructive mt-1">{formatKES(profData?.summary?.total_direct_costs ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Contribution</span><p className="text-xl font-mono font-bold text-success mt-1">{formatKES(profData?.summary?.total_contribution ?? 0)}</p></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle>Trip Contribution Breakdown</CardTitle><CardDescription>{profData?.summary?.note || 'Revenue minus approved direct trip expenses.'}</CardDescription></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border"><tr>
              <th className="py-3 px-4 text-left">Trip</th><th className="py-3 px-4 text-right">KM</th><th className="py-3 px-4 text-right">Revenue</th><th className="py-3 px-4 text-right">Direct Costs</th><th className="py-3 px-4 text-right font-semibold text-success">Contribution</th><th className="py-3 px-4 text-right">Margin</th><th className="py-3 px-4 text-right">KES/KM</th>
            </tr></thead><tbody className="divide-y divide-border">
              {profLoading ? [...Array(6)].map((_,i)=><tr key={i}><td colSpan={7} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>) :
              paged.rows.map((t:any)=>(<tr key={t.trip_id} className="hover:bg-muted/40"><td className="py-3.5 px-4 font-mono font-bold text-primary"><Link href={`/trips/${t.trip_id}`} className="hover:underline inline-flex items-center gap-1">{t.reference}<ArrowUpRight className="h-3 w-3"/></Link></td><td className="py-3.5 px-4 text-right font-mono text-xs">{formatKm(t.distance_km)}</td><td className="py-3.5 px-4 text-right font-mono text-xs">{formatKES(t.revenue)}</td><td className="py-3.5 px-4 text-right font-mono text-xs text-destructive">{formatKES(t.approved_direct_costs)}</td><td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-success">{formatKES(t.contribution)}</td><td className="py-3.5 px-4 text-right font-mono text-xs font-semibold">{t.contribution_margin_pct}%</td><td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">{t.contribution_per_km}</td></tr>))}
            </tbody></table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="fuel_efficiency" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4"><span className="text-xs font-medium uppercase text-muted-foreground">Fuel Entries</span><p className="text-2xl font-bold mt-1">{fuelData?.summary?.total_fuel_entries ?? 0}</p></Card>
            <Card className="p-4 border-destructive/30"><span className="text-xs font-medium uppercase text-destructive">Anomalies</span><p className="text-2xl font-bold text-destructive mt-1">{fuelData?.summary?.anomalies_detected ?? 0}</p></Card>
            <Card className="p-4"><span className="text-xs font-medium uppercase text-muted-foreground">Total Fuel Cost</span><p className="text-2xl font-bold text-primary mt-1">{formatKES(fuelData?.summary?.total_fuel_cost ?? 0)}</p></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle>Refill Log & Anomaly Trail</CardTitle><CardDescription>Fuel entries with odometer/litre checks vs rolling average</CardDescription></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border"><tr>
              <th className="py-3 px-4 text-left">Date</th><th className="py-3 px-4 text-left">Truck</th><th className="py-3 px-4 text-left">Trip</th><th className="py-3 px-4 text-right">Litres</th><th className="py-3 px-4 text-right">Cost</th><th className="py-3 px-4 text-center">Km/L</th><th className="py-3 px-4 text-center">Audit</th>
            </tr></thead><tbody className="divide-y divide-border">
              {fuelLoading ? [...Array(6)].map((_,i)=><tr key={i}><td colSpan={7} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>) :
              paged.rows.map((f:any)=>(<tr key={f.expense_id} className={`hover:bg-muted/40 ${f.analysis?.is_anomaly?'bg-destructive-bg/30':''}`}><td className="py-3.5 px-4 text-xs text-muted-foreground">{formatDate(f.date)}</td><td className="py-3.5 px-4 font-mono font-bold">{f.truck}</td><td className="py-3.5 px-4 font-mono text-xs text-primary">{f.trip_reference}</td><td className="py-3.5 px-4 text-right font-mono text-xs">{f.litres} L</td><td className="py-3.5 px-4 text-right font-mono text-xs">{formatKES(f.amount)}</td><td className="py-3.5 px-4 text-center font-mono font-bold text-sm">{f.analysis?.km_per_litre?`${f.analysis.km_per_litre} km/L`:'—'}</td><td className="py-3.5 px-4 text-center">{f.analysis?.is_anomaly ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive-bg text-destructive border border-destructive/30"><AlertTriangle className="h-3 w-3"/>{f.analysis.deviation_pct}%</span> : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success border border-success/30">Normal</span>}</td></tr>))}
            </tbody></table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="customer_aging" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 sm:col-span-2"><span className="text-[11px] text-muted-foreground uppercase">Total Receivables</span><p className="text-2xl font-mono font-bold text-destructive mt-1">{formatKES(agingData?.total_receivables ?? 0)}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">Customers Owing</span><p className="text-xl font-bold mt-1">{agingData?.customers?.length ?? 0}</p></Card>
            <Card className="p-3.5"><span className="text-[11px] text-muted-foreground uppercase">As of</span><p className="text-sm font-semibold mt-2">{agingData?.as_of_date ? formatDate(agingData.as_of_date) : '—'}</p></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle>Customer Receivables Ageing</CardTitle><CardDescription>Outstanding balances by ageing bucket (real-time invoice/payment/credit state)</CardDescription></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border"><tr>
              <th className="py-3 px-4 text-left">Customer</th><th className="py-3 px-4 text-right font-bold text-destructive">Total Owed</th><th className="py-3 px-4 text-right">Current</th><th className="py-3 px-4 text-right">1–30</th><th className="py-3 px-4 text-right">31–60</th><th className="py-3 px-4 text-right text-destructive">61–90+</th>
            </tr></thead><tbody className="divide-y divide-border">
              {agingLoading ? [...Array(6)].map((_,i)=><tr key={i}><td colSpan={6} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>) :
              paged.rows.map((c:any)=>(<tr key={c.id} className="hover:bg-muted/40"><td className="py-3.5 px-4 font-semibold">{c.name}<span className="block text-[11px] text-muted-foreground font-normal">{c.phone||''}</span></td><td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-destructive">{formatKES(c.total_balance_owed)}</td><td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">{c.current?formatKES(c.current):'—'}</td><td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">{c.days_1_30?formatKES(c.days_1_30):'—'}</td><td className="py-3.5 px-4 text-right font-mono text-xs text-warning font-medium">{c.days_31_60?formatKES(c.days_31_60):'—'}</td><td className="py-3.5 px-4 text-right font-mono text-xs text-destructive font-bold">{(c.days_61_90||c.days_90_plus)?formatKES((c.days_61_90||0)+(c.days_90_plus||0)):'—'}</td></tr>))}
            </tbody></table></div></CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{paged.meta.from}</span>–<span className="font-semibold text-foreground">{paged.meta.to}</span> of <span className="font-semibold text-foreground">{paged.meta.total}</span> rows in this tab</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Rows</label>
          <select value={perPage} onChange={e=>setPerPage(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-input bg-card text-xs">{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select>
          <Button variant="outline" size="sm" className="h-8 px-2" disabled={paged.meta.page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft className="h-3.5 w-3.5"/></Button>
          <span className="text-xs text-muted-foreground">Page <span className="font-semibold text-foreground">{paged.meta.page}</span> of <span className="font-semibold text-foreground">{paged.meta.last_page}</span></span>
          <Button variant="outline" size="sm" className="h-8 px-2" disabled={paged.meta.page>=paged.meta.last_page} onClick={()=>setPage(p=>Math.min(paged.meta.last_page,p+1))}><ChevronRight className="h-3.5 w-3.5"/></Button>
        </div>
      </div>
    </div>
  );
}