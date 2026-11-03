'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Truck,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { User } from '@/types';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password dialog state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'owner@haultrack.co.ke',
      password: 'password123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ token: string; user: User }>('/auth/login', data);
      login(response.token, response.user);
      toast.success(`Welcome back, ${response.user.name}`);

      if (response.user.role === 'driver') {
        router.push('/driver');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setError(msg);
      toast.error('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      toast.error('Please enter a valid work email');
      return;
    }
    setIsForgotLoading(true);
    setTimeout(() => {
      setIsForgotLoading(false);
      setForgotSubmitted(true);
      toast.success('Password reset instructions sent');
    }, 800);
  };

  const setDemoRole = (roleEmail: string) => {
    setValue('email', roleEmail);
    setValue('password', 'password123');
    setError(null);
    toast.info(`Loaded demo credentials for ${roleEmail.split('@')[0]}`);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 bg-[#0B1220]">
      {/* Background Image Layer with Heavy Shadow Fade & Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2000&q=85')`,
        }}
      />

      {/* Dark Vignette & Shadow Fade Overlays */}
      <div className="absolute inset-0 bg-[#0B1220]/80 backdrop-blur-[3px]" />
      <div className="absolute inset-0 bg-black/40 shadow-inner" />

      {/* Main Glassmorphic Card Container */}
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl glass-surface p-7 sm:p-8 shadow-2xl border border-white/20 dark:border-white/10 backdrop-blur-xl bg-white/95 dark:bg-[#111A2B]/95">
        {/* Brand Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm font-bold text-xl">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                  HaulTrack
                </h1>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-muted-foreground">East Africa Logistics Operations</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live KES
            </span>
          </div>
        </div>

        {/* Intro Text */}
        <div className="mb-5">
          <h2 className="text-base font-semibold text-foreground">Sign in to your fleet</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Single-trip revenue, driver advances settlement, and fuel tracking.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-destructive-bg text-destructive border border-destructive/20 text-xs font-medium animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5 flex items-center justify-between">
              <span>Work Email</span>
            </label>
            <div className="relative">
              <Input
                type="email"
                placeholder="e.g. owner@haultrack.co.ke"
                {...register('email')}
                className={`pl-9 ${errors.email ? 'border-destructive' : ''}`}
                disabled={isLoading}
              />
              <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {errors.email && (
              <p className="text-[11px] text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-foreground block">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(errors.email ? '' : 'owner@haultrack.co.ke');
                  setForgotSubmitted(false);
                  setIsForgotPasswordOpen(true);
                }}
                className="text-[11px] font-medium text-primary hover:underline hover:text-primary/90 transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`pl-9 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                disabled={isLoading}
              />
              <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span>Keep me signed in for 30 days</span>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full mt-3 font-semibold h-10 shadow-sm"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In to Workspace'}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        {/* Quick Demo Switcher */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Quick Demo Accounts:</span>
            </span>
            <span className="text-[10px] text-muted-foreground lowercase">Click to autofill</span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDemoRole('owner@haultrack.co.ke')}
              className="p-2 rounded-lg border border-border bg-secondary/70 hover:bg-muted text-left font-medium transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <div className="font-semibold text-primary">Owner</div>
              <div className="text-[10px] text-muted-foreground">Full Org Control</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('manager@haultrack.co.ke')}
              className="p-2 rounded-lg border border-border bg-secondary/70 hover:bg-muted text-left font-medium transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <div className="font-semibold text-primary">Manager</div>
              <div className="text-[10px] text-muted-foreground">Fleet & Dispatch</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('accountant@haultrack.co.ke')}
              className="p-2 rounded-lg border border-border bg-secondary/70 hover:bg-muted text-left font-medium transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <div className="font-semibold text-primary">Accountant</div>
              <div className="text-[10px] text-muted-foreground">Invoices & Advances</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('driver@haultrack.co.ke')}
              className="p-2 rounded-lg border border-border bg-secondary/70 hover:bg-muted text-left font-medium transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <div className="font-semibold text-accent">Driver</div>
              <div className="text-[10px] text-muted-foreground">Mobile Camera & Trips</div>
            </button>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Africa/Nairobi Timezone</span>
          <span>Multi-tenant Isolation</span>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-primary" />
              Reset Workspace Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your registered work email to receive password reset instructions.
            </DialogDescription>
          </DialogHeader>

          {forgotSubmitted ? (
            <div className="py-4 space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Reset instructions sent!</p>
                  <p className="mt-0.5 text-muted-foreground">
                    If an account matches <strong>{forgotEmail}</strong>, an automated recovery link has been dispatched.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-secondary/80 border border-border text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Demo Environment Note:</p>
                <p>
                  For this MVP template, default accounts can be accessed using password{' '}
                  <code className="font-mono bg-card px-1 py-0.5 rounded text-primary font-bold">
                    password123
                  </code>
                  .
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full mt-2"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Registered Work Email
                </label>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. owner@haultrack.co.ke"
                  required
                />
              </div>

              <div className="p-2.5 rounded-lg bg-muted text-[11px] text-muted-foreground">
                System administrators can also reset user credentials directly under{' '}
                <strong>Settings &rarr; Team</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotPasswordOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isForgotLoading}>
                  {isForgotLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
