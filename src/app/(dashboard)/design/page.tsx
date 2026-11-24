'use client';

import React from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MoneyText } from '@/components/shared/MoneyText';
import { TripStepper } from '@/components/shared/TripStepper';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Palette,
  Sparkles,
  Layers,
} from 'lucide-react';
import { formatKES, formatKm } from '@/lib/formatters';

export default function DesignSystemPage() {
  const palette = [
    { name: 'Primary (Harbor Blue)', hex: '#1E5AA8', darkHex: '#4C8DFF', bg: 'bg-primary', text: 'text-white', usage: 'Main actions, active tabs' },
    { name: 'Accent (Signal Amber)', hex: '#F5A623', darkHex: '#FBBF24', bg: 'bg-accent', text: 'text-accent-foreground', usage: 'Highlights, active trip calls' },
    { name: 'Success', hex: '#16A34A', darkHex: '#34D399', bg: 'bg-success', text: 'text-white', usage: 'Delivered, paid, positive contribution' },
    { name: 'Warning', hex: '#D97706', darkHex: '#FBBF24', bg: 'bg-warning', text: 'text-white', usage: 'Due soon, maintenance upcoming' },
    { name: 'Destructive', hex: '#DC2626', darkHex: '#F87171', bg: 'bg-destructive', text: 'text-white', usage: 'Overdue invoices, fuel anomalies' },
    { name: 'Info', hex: '#0284C7', darkHex: '#38BDF8', bg: 'bg-info', text: 'text-white', usage: 'In transit status, general metrics' },
  ];

  return (
    <div className="space-y-10 pb-16">
      <PageHeader
        title="HaulTrack Design System Specification"
        description="Visual style guide, solid color tokens (NO GRADIENTS), typography rules, component variants, and glassmorphism boundaries."
        actions={
          <Badge variant="accent" className="px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            <span>Dev Showcase /design</span>
          </Badge>
        }
      />

      {/* 1. Visual Rules Reminder */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span>Core Visual Principles (Strictly Enforced)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>• <strong>NO GRADIENTS:</strong> Zero gradient backgrounds, buttons, cards, charts, or text. Flat solid colors only.</p>
          <p>• <strong>Depth:</strong> Clean 1px solid borders (`border-border`), 12px radii for cards/dialogs, 8px for inputs/buttons, full pill for badges.</p>
          <p>• <strong>Currency:</strong> Right-aligned, formatted with Kenyan Shillings (`KSh 140,000.00`) and tabular-nums.</p>
          <p>• <strong>Glassmorphism Scope:</strong> Strictly confined to top navigation bar, login card, modal backdrops, and mobile action bars. Never applied to tables, forms, or reports.</p>
        </CardContent>
      </Card>

      {/* 2. Color Palette Matrix */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">1. Flat Solid Color System</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {palette.map((color) => (
            <Card key={color.name} className="overflow-hidden">
              <div className={`h-16 ${color.bg} ${color.text} flex items-center justify-between px-4 font-bold text-sm`}>
                <span>{color.name}</span>
                <span className="font-mono text-xs">{color.hex}</span>
              </div>
              <CardContent className="p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">Role: {color.usage}</p>
                <p className="text-muted-foreground">Dark mode counterpart: <span className="font-mono font-semibold">{color.darkHex}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. Typography Scale & Numerics */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">2. Typography & Numerics</h2>
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-1 pb-4 border-b border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Page Title (24/32 Semibold - Inter)</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Nairobi Inland Container Depot (ICD)</h1>
            </div>

            <div className="space-y-1 pb-4 border-b border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Section Title (18/28 Medium - Inter)</span>
              <h2 className="text-lg font-semibold text-foreground">Fleet Operational Contribution & Trip Ledger</h2>
            </div>

            <div className="space-y-1 pb-4 border-b border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Body Copy (14/20 Regular - Inter)</span>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Truck owners cannot see what each trip and each truck really earns or costs. Fuel theft, unsettled driver advances, late customer payments, idle trucks, and missed compliance renewals quietly eat profit.
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Tabular Numerics & References (JetBrains Mono & Tabular Figures)</span>
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 pt-2 font-mono text-xs sm:text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block font-sans">Trip Reference:</span>
                  <span className="font-bold text-primary">TRIP-0042</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-sans">Truck Plate:</span>
                  <span className="font-bold text-foreground">KDA 482B</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-sans">Odometer:</span>
                  <span className="font-bold text-foreground tabular-nums">142,500 km</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-sans">Contribution (KES):</span>
                  <span className="font-bold text-success tabular-nums">KSh 112,400.00</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Buttons Showcase */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">3. Buttons</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="default">Primary Harbor Blue</Button>
              <Button variant="accent">Accent Signal Amber</Button>
              <Button variant="outline">Outline Neutral</Button>
              <Button variant="secondary">Secondary Surface</Button>
              <Button variant="success">Success Action</Button>
              <Button variant="destructive">Destructive Reject</Button>
              <Button variant="ghost">Ghost Option</Button>
              <Button variant="default" size="sm">Small (32px)</Button>
              <Button variant="default" size="lg">Large (44px Touch)</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Status Badges Showcase */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">4. Semantic Status Badges (Light-tinted solid backgrounds)</h2>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Trip Status Lifecycle:</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="planned" />
                <StatusBadge status="in_transit" />
                <StatusBadge status="delivered" />
                <StatusBadge status="invoiced" />
                <StatusBadge status="paid" />
                <StatusBadge status="cancelled" />
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Fleet Vehicle & Operations:</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="available" />
                <StatusBadge status="on_trip" />
                <StatusBadge status="maintenance" />
                <StatusBadge status="open" />
                <StatusBadge status="settled" />
                <StatusBadge status="overdue" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. Stepper Showcase */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">5. Trip Stepper Component</h2>
        <Card className="p-6">
          <TripStepper currentStatus="invoiced" />
        </Card>
      </section>

      {/* 7. Glassmorphism Example */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">6. Allowed Glassmorphism Surface</h2>
        <div className="relative p-8 rounded-xl bg-[#0F1B2D] overflow-hidden">
          <div className="max-w-md mx-auto p-6 rounded-xl glass-surface bg-white/90 dark:bg-[#111A2B]/90 shadow-2xl border border-white/20">
            <h3 className="font-bold text-foreground text-sm">Frosted Glass Card Container</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Allowed ONLY on top bar, login dialog, and mobile bottom bar. 1px translucent border, solid color backdrop, no gradients.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs font-medium">
              <span className="text-primary font-semibold">Simba Hauliers Kenya</span>
              <span className="font-mono text-muted-foreground">KES Currency</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

