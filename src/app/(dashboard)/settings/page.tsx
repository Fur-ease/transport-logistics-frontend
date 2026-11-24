'use client';
import { syncFinancialState } from '@/lib/liveSync';

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
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
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
import { api, ApiError, clearAuthToken } from '@/lib/api';
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
  const { user: currentUser, isOwner } = useAuth();
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [rulesPage, setRulesPage] = useState(1);

  // Edit / Delete user state (owner only)
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'driver' as 'owner' | 'manager' | 'accountant' | 'driver',
    password: '',
  });
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof editUserForm }) =>
      api.put(`/settings/users/${id}`, {
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        role: payload.role,
        ...(payload.password ? { password: payload.password } : {}),
      }),
    onSuccess: () => {
      toast.success('Team member updated');
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update team member');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ message: string }>(`/settings/users/${id}`),
    onSuccess: (res) => {
      toast.success(res.message || 'Team member removed');
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete team member');
    },
  });

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: '', color: '', width: '0%' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-rose-500 text-rose-600', width: '25%' };
    if (score === 2) return { label: 'Fair', color: 'bg-amber-500 text-amber-600', width: '50%' };
    if (score === 3 || score === 4) return { label: 'Good', color: 'bg-blue-500 text-blue-600', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-500 text-emerald-600', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const isSameAsCurrent = Boolean(currentPassword && newPassword && currentPassword === newPassword);
  const passwordsMismatch = Boolean(confirmPassword && newPassword !== confirmPassword);
  const canSubmitPassword =
    Boolean(currentPassword) &&
    newPassword.length >= 6 &&
    !isSameAsCurrent &&
    newPassword === confirmPassword;

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      setPasswordError(null);
      return api.post<{ message: string }>('/auth/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Password changed. Please log in again.');
      clearAuthToken();
      window.location.href = '/login';
    },
    onError: (err: unknown) => {
      let msg = 'Failed to change password';
      if (err instanceof ApiError && err.errors) {
        const firstField = Object.values(err.errors)[0];
        if (firstField && firstField[0]) msg = firstField[0];
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setPasswordError(msg);
      toast.error(msg);
    },
  });

  // Queries
  const { data: orgData, isLoading: isOrgLoading } = useQuery<{ data: Organization }>({
    queryKey: ['settings-org'],
    queryFn: () => api.get<{ data: Organization }>('/settings/organization'),
  });

  type Paginated<T> = { data: T[]; current_page?: number; last_page?: number; per_page?: number; total?: number; meta?: any };

  const { data: usersData, isLoading: isUsersLoading } = useQuery<Paginated<User>>({
    queryKey: ['settings-users', usersPage],
    queryFn: () => api.get<Paginated<User>>(`/settings/users?per_page=10&page=${usersPage}`),
    placeholderData: (prev) => prev,
  });

  const { data: auditData, isLoading: isAuditLoading } = useQuery<Paginated<AuditLog>>({
    queryKey: ['settings-audit-logs', auditPage],
    queryFn: () => api.get<Paginated<AuditLog>>(`/settings/audit-logs?per_page=15&page=${auditPage}`),
    placeholderData: (prev) => prev,
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
  const ruleEntries = Object.entries(rules);
  const rulesPerPage = 10;
  const rulesLastPage = Math.max(1, Math.ceil(ruleEntries.length / rulesPerPage));
  const safeRulesPage = Math.min(rulesPage, rulesLastPage);
  const pagedRuleEntries = ruleEntries.slice((safeRulesPage - 1) * rulesPerPage, safeRulesPage * rulesPerPage);

  const org = orgData?.data;
  const teamMembers = usersData?.data || [];
  const auditLogs = auditData?.data || [];
  const usersMeta = usersData?.meta ?? usersData;
  const auditMeta = auditData?.meta ?? auditData;

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
    onSuccess: async () => {
      await syncFinancialState(queryClient);
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
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: UserFormData) => api.post('/settings/users', userData),
    onSuccess: async () => {
      await syncFinancialState(queryClient);
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
    onSuccess: async () => {
      await syncFinancialState(queryClient);
      await syncFinancialState(queryClient);
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
        <TabsList className="flex items-center justify-start overflow-x-auto w-full p-1 h-auto text-xs gap-1">
          <TabsTrigger value="organization" className="shrink-0 whitespace-nowrap">Organization</TabsTrigger>
          <TabsTrigger value="users" className="shrink-0 whitespace-nowrap">Team &amp; Roles ({usersMeta?.total ?? teamMembers.length})</TabsTrigger>
          <TabsTrigger value="thresholds" className="shrink-0 whitespace-nowrap">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="data-quality" className="shrink-0 whitespace-nowrap">Data Quality Rules (13)</TabsTrigger>
          <TabsTrigger value="audit" className="shrink-0 whitespace-nowrap">System Audit Logs</TabsTrigger>
          <TabsTrigger value="security" className="shrink-0 whitespace-nowrap">Security</TabsTrigger>
        </TabsList>

        {/* Tab 1: Organization Profile */}
        <TabsContent value="organization" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Commercial Carrier Identity</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Organization legal business details and East Africa currency localization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl p-4 sm:p-6 pt-0 sm:pt-0">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Company Trading Name</label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Simba Hauliers Kenya Ltd"
                  className="w-full text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Base Currency</label>
                  <Input value="KES (Kenya Shillings)" disabled className="bg-secondary cursor-not-allowed text-xs sm:text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Timezone</label>
                  <Input value="Africa/Nairobi (EAT, UTC+3)" disabled className="bg-secondary cursor-not-allowed text-xs sm:text-sm" />
                </div>
              </div>

              <Button
                onClick={() => updateOrgMutation.mutate()}
                disabled={updateOrgMutation.isPending}
                size="sm"
                className="w-full sm:w-auto"
              >
                {updateOrgMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Security / Change Password */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Change Password</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Update your account password. You will be signed out and asked to log in again.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-md p-4 sm:p-6 pt-0 sm:pt-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmitPassword) changePasswordMutation.mutate();
                }}
                className="space-y-4"
              >
                {passwordError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="break-words">{passwordError}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Enter current password"
                      className="pr-10 text-xs sm:text-sm"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Minimum 6 characters"
                      className="pr-10 text-xs sm:text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${passwordStrength.color.split(' ')[0]}`}
                          style={{ width: passwordStrength.width }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-medium ${passwordStrength.color.split(' ')[1]}`}>
                          Strength: {passwordStrength.label}
                        </span>
                        {newPassword.length < 6 && (
                          <span className="text-destructive">At least 6 characters required</span>
                        )}
                      </div>
                    </div>
                  )}

                  {isSameAsCurrent && (
                    <p className="text-[11px] text-destructive mt-1">
                      New password must be different from your current password.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Confirm New Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Re-enter new password"
                      className="pr-10 text-xs sm:text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {passwordsMismatch && (
                    <p className="text-[11px] text-destructive mt-1">Passwords do not match.</p>
                  )}
                  {confirmPassword && !passwordsMismatch && newPassword.length >= 6 && !isSameAsCurrent && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={changePasswordMutation.isPending || !canSubmitPassword}
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Team Members & Roles */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6 pb-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Team Members & Access Roles</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Roles: Owner, Fleet Manager, Finance Accountant, and Field Driver
                </CardDescription>
              </div>
              {isOwner && (
                <Button size="sm" onClick={() => setAddUserModalOpen(true)} className="w-full sm:w-auto shrink-0">
                  <Plus className="mr-1.5 h-4 w-4" />
                  <span>Invite Member</span>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile View: Cards */}
              <div className="sm:hidden divide-y divide-border">
                {teamMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No team members found.</div>
                ) : (
                  teamMembers.map((m) => (
                    <div key={m.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {m.name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-sm truncate">{m.name}</div>
                            <div className="text-xs font-mono text-muted-foreground truncate">{m.email}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-secondary text-foreground border border-border shrink-0">
                          {m.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground font-mono">{m.phone || '—'}</span>
                        {isOwner && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => {
                                setEditingUser(m);
                                setEditUserForm({
                                  name: m.name,
                                  email: m.email,
                                  phone: m.phone || '',
                                  role: (m.role === 'super_admin' ? 'owner' : m.role) as 'owner' | 'manager' | 'accountant' | 'driver',
                                  password: '',
                                });
                              }}
                              title="Edit user"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={m.id === currentUser?.id}
                              onClick={() => setDeletingUser(m)}
                              title={m.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete user'}
                              className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
                  <thead className="bg-secondary/60 text-muted-foreground text-xs uppercase border-y border-border">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium">User</th>
                      <th className="py-3 px-4 text-left font-medium">Email</th>
                      <th className="py-3 px-4 text-left font-medium">Phone</th>
                      <th className="py-3 px-4 text-center font-medium">Role</th>
                      {isOwner && <th className="py-3 px-4 text-right font-medium">Actions</th>}
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
                        {isOwner && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingUser(m);
                                  setEditUserForm({
                                    name: m.name,
                                    email: m.email,
                                    phone: m.phone || '',
                                    role: (m.role === 'super_admin' ? 'owner' : m.role) as 'owner' | 'manager' | 'accountant' | 'driver',
                                    password: '',
                                  });
                                }}
                                title="Edit user"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={m.id === currentUser?.id}
                                onClick={() => setDeletingUser(m)}
                                title={m.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete user'}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border text-xs">
                <span className="text-muted-foreground text-center sm:text-left">Page {usersMeta?.current_page ?? usersPage} of {usersMeta?.last_page ?? 1} • {usersMeta?.total ?? teamMembers.length} users</span>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                  <Button size="sm" variant="outline" disabled={(usersMeta?.current_page ?? usersPage) <= 1} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={(usersMeta?.current_page ?? usersPage) >= (usersMeta?.last_page ?? 1)} onClick={() => setUsersPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Alert Thresholds */}
        <TabsContent value="thresholds" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Operations & Fuel Alert Rules</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Automated scheduler scans compliance expiry, overdue invoices and fuel theft
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl text-xs p-4 sm:p-6 pt-0 sm:pt-0">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Fuel Anomaly Threshold (% worse than rolling average)
                </label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={fuelThreshold}
                    onChange={(e) => setFuelThreshold(Number(e.target.value))}
                    className="w-28 sm:w-32 text-xs sm:text-sm"
                  />
                  <span className="text-muted-foreground font-medium text-xs sm:text-sm">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default 20.00%. Any refill km/L falling below 80% of vehicle baseline triggers an instant anomaly flag.
                </p>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-secondary border border-border space-y-1">
                <p className="font-semibold text-foreground text-xs sm:text-sm">Compliance Document Renewal Alerts</p>
                <p className="text-muted-foreground text-xs">
                  The automated daily scheduler flags NTSA inspection, speed governor, and commercial insurance expiring within 30 days.
                </p>
              </div>

              <Button
                onClick={() => updateOrgMutation.mutate()}
                disabled={updateOrgMutation.isPending}
                size="sm"
                className="w-full sm:w-auto"
              >
                Save Thresholds
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Advancement C - Data Quality Rule Thresholds */}
        <TabsContent value="data-quality" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4 sm:p-6 pb-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Continuous Scanner Rule Configuration</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Define active detection rules, operational day limits, and cash thresholds for missing fleet entries.
                </CardDescription>
              </div>
              {currentUser?.role !== 'owner' && currentUser?.role !== 'manager' && (
                <span className="text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-md self-start sm:self-auto">
                  Read-only (Owner/Manager required)
                </span>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile View: Cards */}
              <div className="sm:hidden divide-y divide-border">
                {pagedRuleEntries.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No data quality rules found.</div>
                ) : (
                  pagedRuleEntries.map(([key, rule]) => {
                    const canEdit = currentUser?.role === 'owner' || currentUser?.role === 'manager';
                    return (
                      <div key={key} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-xs sm:text-sm">{rule.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                              rule.enabled
                                ? 'bg-success/15 text-success'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-border/50">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-secondary px-2 py-0.5 rounded text-[10px] font-medium text-foreground">
                              {rule.category}
                            </span>
                            {rule.threshold_days !== null && (
                              <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                {rule.threshold_days}d limit
                              </span>
                            )}
                            {rule.threshold_amount !== null && rule.threshold_amount !== undefined && (
                              <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                KSh {Number(rule.threshold_amount).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant={rule.enabled ? 'outline' : 'default'}
                              className="h-7 text-xs px-2.5 shrink-0"
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs min-w-[700px]">
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
                    {pagedRuleEntries.map(([key, rule]) => {
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
                            {rule.threshold_amount !== null && rule.threshold_amount !== undefined ? (
                              <div className="font-mono text-xs">
                                KSh {Number(rule.threshold_amount).toLocaleString()}
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border text-xs">
                <span className="text-muted-foreground text-center sm:text-left">Page {safeRulesPage} of {rulesLastPage} • {ruleEntries.length} rules</span>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                  <Button size="sm" variant="outline" disabled={safeRulesPage <= 1} onClick={() => setRulesPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={safeRulesPage >= rulesLastPage} onClick={() => setRulesPage((p) => Math.min(rulesLastPage, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: System Audit Logs */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base sm:text-lg">Audit Trail Logs</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Tracks critical operational actions: expense reassignments, payment recordings, and compliance changes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile View: Cards */}
              <div className="sm:hidden divide-y divide-border">
                {auditLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No audit logs found.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-xs truncate">
                          {log.user?.name || 'System Scheduler'}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded shrink-0">
                          {log.action}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground break-words">
                        {log.reason || 'Record updated'}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground/75 pt-1">
                        {formatDateTime(log.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border text-xs">
                <span className="text-muted-foreground text-center sm:text-left">Page {auditMeta?.current_page ?? auditPage} of {auditMeta?.last_page ?? 1} • {auditMeta?.total ?? auditLogs.length} logs</span>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                  <Button size="sm" variant="outline" disabled={(auditMeta?.current_page ?? auditPage) <= 1} onClick={() => setAuditPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={(auditMeta?.current_page ?? auditPage) >= (auditMeta?.last_page ?? 1)} onClick={() => setAuditPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <Dialog open={addUserModalOpen} onOpenChange={setAddUserModalOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[88vh] overflow-y-auto">
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
                <option value="manager">Manager (Fleet, dispatches &amp; drivers)</option>
                <option value="accountant">Accountant (Invoices, billing &amp; advances)</option>
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

            <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setAddUserModalOpen(false)}
                disabled={createUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Inviting...' : 'Add Team Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog (Owner Only) */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update member profile, role, or reset their password.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingUser) {
                updateUserMutation.mutate({ id: editingUser.id, payload: editUserForm });
              }
            }}
            className="space-y-4 py-2"
          >
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
              <Input
                required
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
              <Input
                required
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
              <Input
                value={editUserForm.phone}
                onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                placeholder="+2547..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Assigned Role</label>
              <select
                value={editUserForm.role}
                onChange={(e) =>
                  setEditUserForm({
                    ...editUserForm,
                    role: e.target.value as 'owner' | 'manager' | 'accountant' | 'driver',
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="owner">Owner (Full administrative control)</option>
                <option value="manager">Manager (Fleet, dispatches &amp; drivers)</option>
                <option value="accountant">Accountant (Invoices, billing &amp; advances)</option>
                <option value="driver">Driver (Mobile camera expense submission)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>
              </label>
              <Input
                type="password"
                minLength={6}
                placeholder="••••••••"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
              />
            </div>

            <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setEditingUser(null)}
                disabled={updateUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog (Owner Only) */}
      <Dialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email})? They will immediately lose access to the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDeletingUser(null)}
              disabled={deleteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={deleteUserMutation.isPending}
              onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

