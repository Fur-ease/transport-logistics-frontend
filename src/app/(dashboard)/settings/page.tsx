'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Settings,
  Building2,
  Users,
  Shield,
  Bell,
  Clock,
  History,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { User, AuditLog, Organization } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';

const userSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  role: z.enum(['owner', 'manager', 'accountant', 'driver']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type UserFormData = z.infer<typeof userSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);

  // Queries
  const { data: orgData, isLoading: isOrgLoading } = useQuery<{ data: Organization }>({
    queryKey: ['settings-org'],
    queryFn: () => api.get<{ data: Organization }>('/settings/organization'),
  });

  const { data: usersData, isLoading: isUsersLoading } = useQuery<{ data: User[] }>({
    queryKey: ['settings-users'],
    queryFn: () => api.get<{ data: User[] }>('/settings/users'),
  });

  const { data: auditData, isLoading: isAuditLoading } = useQuery<{ data: AuditLog[] }>({
    queryKey: ['settings-audit-logs'],
    queryFn: () => api.get<{ data: AuditLog[] }>('/settings/audit-logs'),
  });

  const { data: rulesData, isLoading: isRulesLoading } = useQuery<{
    data: Record<string, {
      rule_key: string;
      label: string;
      category: string;
      enabled: boolean;
      threshold_days: number | null;
      threshold_amount: number | null;
      description: string;
    }>;
  }>({
    queryKey: ['settings-rules'],
    queryFn: () => api.get('/settings/rule-thresholds'),
  });
  const rules = rulesData?.data || {};

  const org = orgData?.data;
  const teamMembers = usersData?.data || [];
  const auditLogs = auditData?.data || [];

  // Org form state
  const [orgName, setOrgName] = useState('');
  const [fuelThreshold, setFuelThreshold] = useState<number>(20);

  React.useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setFuelThreshold(org.fuel_alert_threshold_pct || 20);
    }
  }, [org]);

  const updateOrgMutation = useMutation({
    mutationFn: () =>
      api.put('/settings/organization', {
        name: orgName,
        fuel_alert_threshold_pct: fuelThreshold,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-org'] });
      toast.success('Organization settings saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update organization');
    },
  });

  // User form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: userErrors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'driver',
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: UserFormData) => api.post('/settings/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      toast.success('User invited to workspace');
      setAddUserModalOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add user');
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: (payload: {
      rule_key: string;
      is_enabled: boolean;
      threshold_days?: number | null;
      threshold_amount?: number | null;
    }) => api.put('/settings/rule-thresholds', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-rules'] });
      queryClient.invalidateQueries({ queryKey: ['missing-entries'] });
      toast.success('Data quality rule updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save rule threshold');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Governance"
        description="Configure organization profile, manage team roles, set fuel anomaly thresholds, and audit operational logs."
      />

      <Tabs defaultValue="organization" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="users">Team &amp; Roles ({teamMembers.length})</TabsTrigger>
          <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="data-quality">Data Quality Rules (13)</TabsTrigger>
          <TabsTrigger value="audit">System Audit Logs</TabsTrigger>
        </TabsList>

        {/* Tab 1: Organization Profile */}
        <TabsContent value="organization" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Commercial Carrier Identity</CardTitle>
              <CardDescription>
                Organization legal business details and East Africa currency localization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Company Trading Name</label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Simba Hauliers Kenya Ltd"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Base Currency</label>
                  <Input value="KES (Kenya Shillings)" disabled className="bg-secondary cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Timezone</label>
                  <Input value="Africa/Nairobi (EAT, UTC+3)" disabled className="bg-secondary cursor-not-allowed" />
                </div>
              </div>

              <Button
                onClick={() => updateOrgMutation.mutate()}
                disabled={updateOrgMutation.isPending}
                size="sm"
              >
                {updateOrgMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Team Members & Roles */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Team Members & Access Roles</CardTitle>
                <CardDescription>
                  Roles: Owner, Fleet Manager, Finance Accountant, and Field Driver
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddUserModalOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                <span>Invite Member</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">User</th>
                      <th className="py-3 px-4 text-left font-medium">Email</th>
                      <th className="py-3 px-4 text-left font-medium">Phone</th>
                      <th className="py-3 px-4 text-center font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teamMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                            {m.name[0]}
                          </div>
                          <span>{m.name}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">{m.email}</td>
                        <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">{m.phone || '—'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-secondary text-foreground border border-border">
                            {m.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Alert Thresholds */}
        <TabsContent value="thresholds" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Operations & Fuel Alert Rules</CardTitle>
              <CardDescription>
                Automated scheduler scans compliance expiry, overdue invoices and fuel theft
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Fuel Anomaly Threshold (% worse than rolling average)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={fuelThreshold}
                    onChange={(e) => setFuelThreshold(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground font-medium">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default 20.00%. Any refill km/L falling below 80% of vehicle baseline triggers an instant anomaly flag.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-secondary border border-border space-y-1">
                <p className="font-semibold text-foreground">Compliance Document Renewal Alerts</p>
                <p className="text-muted-foreground">
                  The automated daily scheduler flags NTSA inspection, speed governor, and commercial insurance expiring within 30 days.
                </p>
              </div>

              <Button
                onClick={() => updateOrgMutation.mutate()}
                disabled={updateOrgMutation.isPending}
                size="sm"
              >
                Save Thresholds
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Advancement C - Data Quality Rule Thresholds */}
        <TabsContent value="data-quality" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Continuous Scanner Rule Configuration</CardTitle>
                  <CardDescription className="text-xs">
                    Define active detection rules, operational day limits, and cash thresholds for missing fleet entries.
                  </CardDescription>
                </div>
                {currentUser?.role !== 'owner' && currentUser?.role !== 'manager' && (
                  <span className="text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-md">
                    Read-only (Owner/Manager required to edit)
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground uppercase border-y border-border">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-medium">Rule &amp; Detection Scope</th>
                      <th className="py-2.5 px-3 text-left font-medium">Category</th>
                      <th className="py-2.5 px-3 text-center font-medium">Status</th>
                      <th className="py-2.5 px-3 text-left font-medium">Days Limit</th>
                      <th className="py-2.5 px-3 text-left font-medium">Amount Limit (KES)</th>
                      <th className="py-2.5 px-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(rules).map(([key, rule]) => {
                      const canEdit = currentUser?.role === 'owner' || currentUser?.role === 'manager';
                      return (
                        <tr key={key} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3 max-w-sm">
                            <div className="font-semibold text-foreground">{rule.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="bg-secondary px-2 py-0.5 rounded text-[10px] font-medium text-foreground">
                              {rule.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                rule.enabled
                                  ? 'bg-success/15 text-success'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {rule.enabled ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {rule.threshold_days !== null ? (
                              <div className="flex items-center gap-1 font-mono text-xs">
                                <span>{rule.threshold_days} days</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {rule.threshold_amount !== null ? (
                              <div className="font-mono text-xs">
                                KSh {rule.threshold_amount.toLocaleString()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant={rule.enabled ? 'outline' : 'default'}
                                className="h-7 text-xs px-2.5"
                                disabled={updateRuleMutation.isPending}
                                onClick={() =>
                                  updateRuleMutation.mutate({
                                    rule_key: key,
                                    is_enabled: !rule.enabled,
                                    threshold_days: rule.threshold_days,
                                    threshold_amount: rule.threshold_amount,
                                  })
                                }
                              >
                                {rule.enabled ? 'Disable' : 'Enable'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: System Audit Logs */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Audit Trail Logs</CardTitle>
              <CardDescription>
                Tracks critical operational actions: expense reassignments, payment recordings, and compliance changes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">Timestamp</th>
                      <th className="py-3 px-4 text-left font-medium">User</th>
                      <th className="py-3 px-4 text-left font-medium">Action</th>
                      <th className="py-3 px-4 text-left font-medium">Reason / Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-foreground">
                          {log.user?.name || 'System Scheduler'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold text-primary uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-md truncate">
                          {log.reason || 'Record updated'}
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

      {/* Invite User Dialog */}
      <Dialog open={addUserModalOpen} onOpenChange={setAddUserModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Grant access to the HaulTrack workspace based on user operational role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((d) => createUserMutation.mutate(d))} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
              <Input placeholder="e.g. Grace Wanjiku" {...register('name')} />
              {userErrors.name && (
                <p className="text-[11px] text-destructive mt-1">{userErrors.name.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
              <Input type="email" placeholder="grace@haultrack.co.ke" {...register('email')} />
              {userErrors.email && (
                <p className="text-[11px] text-destructive mt-1">{userErrors.email.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
              <Input placeholder="+2547..." {...register('phone')} />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Assigned Role</label>
              <select
                {...register('role')}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="owner">Owner (Full administrative control)</option>
                <option value="manager">Manager (Fleet, dispatches & drivers)</option>
                <option value="accountant">Accountant (Invoices, billing & advances)</option>
                <option value="driver">Driver (Mobile camera expense submission)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Initial Password</label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {userErrors.password && (
                <p className="text-[11px] text-destructive mt-1">{userErrors.password.message}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddUserModalOpen(false)}
                disabled={createUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Inviting...' : 'Add Team Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

