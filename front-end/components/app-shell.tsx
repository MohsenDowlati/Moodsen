'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarHeart,
  Sparkles,
  CalendarDays,
  TrendingUp,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import type { ViewId } from '@/lib/types';
import { NotificationBell } from '@/components/notification-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const NAV: Array<{ id: ViewId; label: string; href: string; icon: typeof Sparkles }> = [
  { id: 'today', label: 'Today', href: '/app/today', icon: Sparkles },
  { id: 'history', label: 'History', href: '/app/history', icon: CalendarDays },
  { id: 'insights', label: 'Insights', href: '/app/insights', icon: TrendingUp },
  { id: 'profile', label: 'Profile', href: '/app/profile', icon: UserIcon },
];

const TITLE_MAP: Record<ViewId, { title: string; subtitle: string }> = {
  today: { title: 'Today', subtitle: 'How are you feeling right now?' },
  history: { title: 'History', subtitle: 'Your mood over time' },
  insights: { title: 'Insights', subtitle: 'Patterns and trends' },
  profile: { title: 'Profile', subtitle: 'Your account and settings' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const active = NAV.find((n) => pathname.startsWith(n.href)) ?? NAV[0];
  const heading = TITLE_MAP[active.id];

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Desktop sidebar ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
        <SidebarContent active={active.id} user={user} onSignOut={signOut} initials={initials} />
      </aside>

      {/* ---- Mobile drawer ---- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card animate-fade-in-up">
            <div className="flex items-center justify-between px-5 pt-5">
              <Brand />
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              active={active.id}
              user={user}
              onSignOut={signOut}
              initials={initials}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ---- Main ---- */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight">{heading.title}</h1>
            <p className="truncate text-xs text-muted-foreground">{heading.subtitle}</p>
          </div>

          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 ring-offset-2 transition hover:ring-2 hover:ring-primary/30">
                <Avatar className="h-9 w-9 border">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/profile">
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

        {/* ---- Mobile bottom nav ---- */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-background/95 backdrop-blur-md lg:hidden">
          {NAV.map((item) => {
            const isActive = active.id === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'scale-110')} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="h-14 lg:hidden" />
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-md shadow-teal-500/20">
        <CalendarHeart className="h-5 w-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">Moodsen</span>
    </div>
  );
}

function SidebarContent({
  active,
  user,
  onSignOut,
  initials,
  onNavigate,
}: {
  active: ViewId;
  user: { name: string; email: string } | null;
  onSignOut: () => void;
  initials: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="hidden items-center gap-2 px-6 pt-6 pb-4 lg:flex">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  isActive ? 'scale-110' : 'group-hover:scale-105',
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card at bottom */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar className="h-9 w-9 border">
            <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="mt-1 w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );
}
