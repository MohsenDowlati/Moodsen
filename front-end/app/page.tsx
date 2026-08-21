'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  TrendingUp,
  CalendarHeart,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MOODS } from '@/lib/moods';

type Mode = 'signin' | 'signup';

const signinSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  full_name: z.string().min(2, 'Tell us your name (2+ characters)'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

type SigninValues = z.infer<typeof signinSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp} = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SigninValues & SignupValues>({
    resolver: zodResolver(mode === 'signin' ? signinSchema : signupSchema) as never,
    mode: 'onBlur',
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    reset();
  };

  const onSubmit = async (values: SigninValues & SignupValues) => {
    setBusy(true);
    try {
      if (mode === 'signin') {
        const data = await signIn(values.email, values.password);
        console.log(data);
        toast.success('Welcome back!');
      } else {
        await signUp(values.full_name, values.email, values.password);
        toast.success('Account created. Welcome to Moodsen!');
      }
      router.replace('/app/today');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* ---- Left brand panel ---- */}
      <BrandPanel />

      {/* ---- Right form panel ---- */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-lg shadow-teal-500/20">
              <CalendarHeart className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Moodsen</span>
          </div>

          <div className="animate-fade-in-up">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'signin'
                ? 'Sign in to continue tracking your mood.'
                : 'Start your mindfulness journey in under a minute.'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <Field
                id="name"
                label="Full name"
                icon={<UserIcon className="h-4 w-4" />}
                error={errors.full_name?.message}
              >
                <Input
                  id="name"
                  placeholder="Mohsen Dowlati"
                  autoComplete="name"
                  className="h-11 border-input bg-background pl-10"
                  {...register('full_name')}
                />
              </Field>
            )}

            <Field
              id="email"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 border-input bg-background pl-10"
                {...register('email')}
              />
            </Field>

            <Field
              id="password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              hint={
                mode === 'signup'
                  ? 'At least 8 characters with a letter and a number'
                  : undefined
              }
            >
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Create a password' : '••••••••'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="h-11 border-input bg-background pl-10 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            {mode === 'signin' && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" className="h-4 w-4 rounded border-input accent-teal-500" defaultChecked />
                  Remember me
                </label>
                <button type="button" className="font-medium text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20 transition-all hover:shadow-xl hover:shadow-teal-500/30 hover:brightness-105"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <span className="font-medium text-foreground hover:underline cursor-pointer">Terms</span>
            {' '}and{' '}
            <span className="font-medium text-foreground hover:underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function BrandPanel() {
  const features = [
    {
      icon: <CalendarHeart className="h-5 w-5" />,
      title: 'Log your day in seconds',
      desc: 'Pick a mood, jot a note, done. Building a habit that sticks.',
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: 'See your patterns',
      desc: 'Calendar heatmaps and trend charts reveal how you really feel over time.',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Private by design',
      desc: 'Your reflections stay yours. No ads, no tracking, no noise.',
    },
  ];

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl animate-float-slower" />
      <div className="pointer-events-none absolute right-20 top-1/3 h-40 w-40 rounded-full bg-cyan-200/10 blur-2xl animate-float-slow" />

      {/* Brand header */}
      <div className="relative z-10 flex items-center gap-3 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
          <CalendarHeart className="h-6 w-6" />
        </div>
        <span className="text-2xl font-semibold tracking-tight">Moodsen</span>
      </div>

      {/* Hero copy */}
      <div className="relative z-10 max-w-md text-white">
        <h2 className="text-3xl font-bold leading-tight xl:text-4xl">
          Understand yourself, one day at a time.
        </h2>
        <p className="mt-4 text-base text-white/80">
          A calm, beautiful space to check in with your feelings, spot trends,
          and build emotional awareness — without the noise.
        </p>

        {/* Floating mood chips */}
        <div className="mt-8 flex flex-wrap gap-2">
          {MOODS.slice(0, 4).map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm"
              style={{ animation: `float-slow ${5 + i}s ease-in-out infinite` }}
            >
              <span>{m.emoji}</span>
              {m.label}
            </div>
          ))}
        </div>

        {/* Feature list */}
        <div className="mt-10 space-y-4">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                {f.icon}
              </div>
              <div>
                <p className="font-semibold text-white">{f.title}</p>
                <p className="text-sm text-white/70">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer quote */}
      <div className="relative z-10 max-w-sm">
        <p className="text-sm italic text-white/70">
          “The simple act of naming how you feel changes everything.”
        </p>
      </div>
    </div>
  );
}
