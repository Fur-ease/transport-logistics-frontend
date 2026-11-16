'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Plus,
  MoreVertical,
  Pencil,
  Lock,
  Unlock,
  Clock,
  MinusCircle,
  Crown,
  Trash2,
  Users,
  Phone,
  Search,
  Activity,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { SaasOrganization } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

const AVATAR_COLORS = [
  'bg-orange-500',
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-teal-600',
];

function formatCountdown(expiresAt: string | null, isLifetimeVip: boolean, nowMs: number) {
  if (isLifetimeVip) {
    return { text: 'LIFETIME VIP', sub: 'Never expires', expired: false, vip: true };
  }
  if (!expiresAt) {
    return { text: 'NO EXPIRY', sub: '—', expired: false, vip: false };
  }

  const targetMs = new Date(expiresAt).getTime();
  const diff = targetMs - nowMs;
  const formattedDate = new Date(expiresAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (diff <= 0) {
    return { text: 'EXPIRED', sub: `Expires: ${formattedDate}`, expired: true, vip: false };
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    text: `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`,
    sub: `Expires: ${formattedDate}`,
    expired: false,
    vip: false,
  };
}

export default function SuperAdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading, isSuperAdmin, logout, enterOrganization } = useAuth();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<SaasOrganization | null>(null);
  const [subModal, setSubModal] = useState<{
    mode: 'extend' | 'reduce';
    org: SaasOrganization;
  } | null>(null);
  const [subDays, setSubDays] = useState<number>(30);
  const [deleteOrg, setDeleteOrg] = useState<SaasOrganization | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState({
    company_name: '',
    category: 'Logistics',
    currency: 'KES',
    subscription_plan: 'Monthly' as 'Monthly' | 'Yearly' | 'Lifetime',
    subscription_price: '4000',
    subscription_days: '30',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_password: 'password123',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    company_name: '',
    category: 'Logistics',
    currency: 'KES',
    subscription_plan: 'Monthly' as 'Monthly' | 'Yearly' | 'Lifetime',
    subscription_price: '4000',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
  });

  // Live 1s countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperAdmin) {
        router.push('/');
      }
    }
  }, [user, isLoading, isSuperAdmin, router]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [openMenuId]);

  const { data, isFetching, refetch } = useQuery<{ data: SaasOrganization[] }>({
    queryKey: ['super-admin-organizations'],
    queryFn: () => api.get<{ data: SaasOrganization[] }>('/super-admin/organizations'),
    enabled: Boolean(user && isSuperAdmin),
  });

  const organizations = useMemo(() => data?.data ?? [], [data]);

  const filteredOrgs = useMemo(() => {
    return organizations.filter((org) => {
      const matchesStatus = statusFilter === 'ALL' || org.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        org.name.toLowerCase().includes(q) ||
        org.category.toLowerCase().includes(q) ||
        (org.owner?.name?.toLowerCase().includes(q) ?? false) ||
        (org.owner?.email?.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [organizations, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: organizations.length,
      active: organizations.filter((o) => o.status === 'ACTIVE').length,
      expired: organizations.filter((o) => o.status === 'EXPIRED').length,
      blocked: organizations.filter((o) => o.status === 'BLOCKED').length,
      vip: organizations.filter((o) => o.status === 'LIFETIME VIP').length,
    };
  }, [organizations]);

  const createMutation = useMutation({
    mutationFn: (payload: typeof addForm) =>
      api.post('/super-admin/organizations', {
        ...payload,
        subscription_price: Number(payload.subscription_price || 0),
        subscription_days:
          payload.subscription_plan === 'Lifetime' ? null : Number(payload.subscription_days || 30),
      }),
    onSuccess: () => {
      toast.success('Company and owner created');
      setAddModalOpen(false);
      setAddForm({
        company_name: '',
        category: 'Logistics',
        currency: 'KES',
        subscription_plan: 'Monthly',
        subscription_price: '4000',
        subscription_days: '30',
        owner_name: '',
        owner_email: '',
        owner_phone: '',
        owner_password: 'password123',
      });
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create company');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof editForm }) =>
      api.put(`/super-admin/organizations/${id}`, {
        ...payload,
        subscription_price: Number(payload.subscription_price || 0),
      }),
    onSuccess: () => {
      toast.success('Organisation updated');
      setEditOrg(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update organisation');
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: (id: number) => api.post<{ message: string }>(`/super-admin/organizations/${id}/toggle-block`),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update access');
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ id, mode, days }: { id: number; mode: 'extend' | 'reduce'; days: number }) =>
      api.post<{ message: string }>(
        `/super-admin/organizations/${id}/${mode === 'extend' ? 'extend-subscription' : 'reduce-subscription'}`,
        { days }
      ),
    onSuccess: (res) => {
      toast.success(res.message);
      setSubModal(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update subscription');
    },
  });

  const vipMutation = useMutation({
    mutationFn: (id: number) => api.post<{ message: string }>(`/super-admin/organizations/${id}/lifetime-vip`),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to set Lifetime VIP');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ message: string }>(`/super-admin/organizations/${id}`),
    onSuccess: (res) => {
      toast.success(res.message);
      setDeleteOrg(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-organizations'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete organisation');
    },
  });

  const openEditModal = (org: SaasOrganization) => {
    setEditOrg(org);
    setEditForm({
      company_name: org.name,
      category: org.category || 'Logistics',
      currency: org.currency || 'KES',
      subscription_plan: org.subscription_plan || 'Monthly',
      subscription_price: String(org.subscription_price ?? 4000),
      owner_name: org.owner?.name || '',
      owner_email: org.owner?.email || '',
      owner_phone: org.owner?.phone || '',
    });
  };

  const handleEnterOrg = (org: SaasOrganization) => {
    enterOrganization({ id: org.id, name: org.name });
    router.push('/');
  };

  if (isLoading || !user || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-600 text-sm">
        Loading SaaS Control Center...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900">
      {/* Top Header matching SaaS Control Center */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                SaaS Control Center
              </h1>
              <span className="inline-block mt-0.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                PLATFORM ADMIN
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Company</span>
            </Button>

            <button
              type="button"
              onClick={() => refetch()}
              title="Refresh"
              className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>

            <div
              title={user.name}
              className="h-9 w-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="h-9 w-9 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Companies', value: stats.total, color: 'text-slate-900', filter: 'ALL' },
            { label: 'Active', value: stats.active, color: 'text-emerald-600', filter: 'ACTIVE' },
            { label: 'Expired', value: stats.expired, color: 'text-amber-600', filter: 'EXPIRED' },
            { label: 'Blocked', value: stats.blocked, color: 'text-rose-600', filter: 'BLOCKED' },
            { label: 'Lifetime VIP', value: stats.vip, color: 'text-purple-600', filter: 'LIFETIME VIP' },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setStatusFilter(s.filter)}
              className={`text-left rounded-xl border p-3 bg-white transition-all ${
                statusFilter === s.filter
                  ? 'border-emerald-500 ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, owner name, or email..."
              className="pl-9 bg-white border-slate-200"
            />
          </div>
          <Button
            onClick={() => setAddModalOpen(true)}
            className="sm:hidden bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Company & Owner
          </Button>
        </div>

        {/* Organization Cards */}
        <div className="space-y-4">
          {filteredOrgs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
              No companies match your filter.
            </div>
          ) : (
            filteredOrgs.map((org, idx) => {
              const countdown = formatCountdown(
                org.subscription_expires_at,
                org.is_lifetime_vip,
                nowMs
              );
              const avatarBg =
                org.status === 'EXPIRED' || org.status === 'BLOCKED'
                  ? 'bg-slate-400'
                  : AVATAR_COLORS[idx % AVATAR_COLORS.length];

              const canEnter = !org.is_blocked && !org.is_expired;

              return (
                <div
                  key={org.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 relative"
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 rounded-xl ${avatarBg} text-white font-bold text-lg flex items-center justify-center shrink-0`}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 truncate">
                            {org.name}
                          </h2>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            {org.category || 'Logistics'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                          {org.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Activity className="h-3 w-3" /> ACTIVE
                            </span>
                          )}
                          {org.status === 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="h-3 w-3" /> EXPIRED
                            </span>
                          )}
                          {org.status === 'BLOCKED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="h-3 w-3" /> BLOCKED
                            </span>
                          )}
                          {org.status === 'LIFETIME VIP' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Crown className="h-3 w-3" /> LIFETIME VIP
                            </span>
                          )}

                          <span className="text-slate-500">• {org.subscription_plan}</span>
                          {!org.is_lifetime_vip && (
                            <span className="font-semibold text-emerald-700">
                              • {org.currency} {Number(org.subscription_price).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Actions: Enter + Menu */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!canEnter}
                        onClick={() => handleEnterOrg(org)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          canEnter
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        Enter
                      </button>

                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                          className="h-8 w-8 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
                          aria-label="Organisation actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openMenuId === org.id && (
                          <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-40">
                            <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                              {org.name}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                openEditModal(org);
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-slate-50 flex items-center gap-2.5"
                            >
                              <Pencil className="h-4 w-4" /> Edit Organisation
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                toggleBlockMutation.mutate(org.id);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 flex items-center gap-2.5 ${
                                org.is_blocked ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {org.is_blocked ? (
                                <>
                                  <Unlock className="h-4 w-4" /> Unblock Access
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4" /> Block Access
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setSubDays(30);
                                setSubModal({ mode: 'extend', org });
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-slate-50 flex items-center gap-2.5"
                            >
                              <Clock className="h-4 w-4" /> Extend Subscription
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setSubDays(7);
                                setSubModal({ mode: 'reduce', org });
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-slate-50 flex items-center gap-2.5"
                            >
                              <MinusCircle className="h-4 w-4" /> Reduce Subscription
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                vipMutation.mutate(org.id);
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-purple-600 hover:bg-slate-50 flex items-center gap-2.5"
                            >
                              <Crown className="h-4 w-4" /> Set Lifetime VIP
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeleteOrg(org);
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                            >
                              <Trash2 className="h-4 w-4" /> Delete Organisation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Info Box: Owner & Countdown */}
                  <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        COMPANY OWNER
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {org.owner?.name || 'No owner assigned'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {org.owner?.email || '—'}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        COUNTDOWN
                      </p>
                      <p
                        className={`text-sm font-bold mt-0.5 font-mono ${
                          countdown.vip
                            ? 'text-purple-600'
                            : countdown.expired
                            ? 'text-rose-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {countdown.text}
                      </p>
                      <p className="text-xs text-slate-500">{countdown.sub}</p>
                    </div>
                  </div>

                  {/* Footer Row */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        <strong>{org.users_count}</strong> Staff ({org.drivers_count} Drivers,{' '}
                        {org.trucks_count} Trucks)
                      </span>
                    </div>
                    {org.owner?.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{org.owner.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add Company & Owner Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Company & Owner</DialogTitle>
            <DialogDescription>
              Create a new tenant company and its Owner account. The owner can add their own managers, accountants, and drivers inside their portal.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(addForm);
            }}
            className="space-y-4 mt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Company Name *</label>
                <Input
                  required
                  value={addForm.company_name}
                  onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                  placeholder="e.g. Coastline Freight Ltd"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <Input
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  placeholder="Logistics / Freight / Haulage"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Plan</label>
                <select
                  value={addForm.subscription_plan}
                  onChange={(e) => {
                    const plan = e.target.value as 'Monthly' | 'Yearly' | 'Lifetime';
                    setAddForm({
                      ...addForm,
                      subscription_plan: plan,
                      subscription_days: plan === 'Yearly' ? '365' : '30',
                    });
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Price ({addForm.currency})</label>
                <Input
                  type="number"
                  min={0}
                  value={addForm.subscription_price}
                  onChange={(e) => setAddForm({ ...addForm, subscription_price: e.target.value })}
                />
              </div>
              {addForm.subscription_plan !== 'Lifetime' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700">Days Valid</label>
                  <Input
                    type="number"
                    min={1}
                    value={addForm.subscription_days}
                    onChange={(e) => setAddForm({ ...addForm, subscription_days: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Company Owner Account
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner Full Name *</label>
                  <Input
                    required
                    value={addForm.owner_name}
                    onChange={(e) => setAddForm({ ...addForm, owner_name: e.target.value })}
                    placeholder="e.g. Ali Hassan"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner Phone</label>
                  <Input
                    value={addForm.owner_phone}
                    onChange={(e) => setAddForm({ ...addForm, owner_phone: e.target.value })}
                    placeholder="+2547..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner Email *</label>
                  <Input
                    required
                    type="email"
                    value={addForm.owner_email}
                    onChange={(e) => setAddForm({ ...addForm, owner_email: e.target.value })}
                    placeholder="owner@company.co.ke"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Initial Password *</label>
                  <Input
                    required
                    type="text"
                    minLength={6}
                    value={addForm.owner_password}
                    onChange={(e) => setAddForm({ ...addForm, owner_password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Company & Owner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Organisation Modal */}
      <Dialog open={Boolean(editOrg)} onOpenChange={(open) => !open && setEditOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Organisation</DialogTitle>
            <DialogDescription>Update company details and owner contact information.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editOrg) updateMutation.mutate({ id: editOrg.id, payload: editForm });
            }}
            className="space-y-3 mt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Company Name *</label>
                <Input
                  required
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <Input
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Plan</label>
                <select
                  value={editForm.subscription_plan}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      subscription_plan: e.target.value as 'Monthly' | 'Yearly' | 'Lifetime',
                    })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Price</label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.subscription_price}
                  onChange={(e) => setEditForm({ ...editForm, subscription_price: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Currency</label>
                <Input
                  value={editForm.currency}
                  onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner Name</label>
                  <Input
                    value={editForm.owner_name}
                    onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner Phone</label>
                  <Input
                    value={editForm.owner_phone}
                    onChange={(e) => setEditForm({ ...editForm, owner_phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Owner Email</label>
                <Input
                  type="email"
                  value={editForm.owner_email}
                  onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOrg(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Extend / Reduce Subscription Modal */}
      <Dialog open={Boolean(subModal)} onOpenChange={(open) => !open && setSubModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {subModal?.mode === 'extend' ? 'Extend Subscription' : 'Reduce Subscription'}
            </DialogTitle>
            <DialogDescription>
              {subModal?.org.name} — choose how many days to{' '}
              {subModal?.mode === 'extend' ? 'add to' : 'subtract from'} the subscription.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex flex-wrap gap-2">
              {(subModal?.mode === 'extend' ? [7, 14, 30, 90, 365] : [1, 7, 14, 30]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSubDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    subDays === d
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {subModal?.mode === 'extend' ? `+${d}d` : `-${d}d`}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Days</label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={subDays}
                onChange={(e) => setSubDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubModal(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={subscriptionMutation.isPending}
                onClick={() =>
                  subModal &&
                  subscriptionMutation.mutate({
                    id: subModal.org.id,
                    mode: subModal.mode,
                    days: subDays,
                  })
                }
                className={
                  subModal?.mode === 'extend'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }
              >
                {subscriptionMutation.isPending
                  ? 'Updating...'
                  : subModal?.mode === 'extend'
                  ? `Extend +${subDays}d`
                  : `Reduce -${subDays}d`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Organisation Confirmation */}
      <Dialog open={Boolean(deleteOrg)} onOpenChange={(open) => !open && setDeleteOrg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Delete Organisation</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteOrg?.name}</strong> and all its users? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOrg(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteOrg && deleteMutation.mutate(deleteOrg.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
