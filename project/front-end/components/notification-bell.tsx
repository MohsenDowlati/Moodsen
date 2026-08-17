'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2, Sparkles, Flame, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from '@/lib/dates';
import type { AppNotification } from '@/lib/types';

function iconForKind(kind: AppNotification['kind']) {
  switch (kind) {
    case 'reminder':
      return <Sparkles className="h-4 w-4 text-teal-500" />;
    case 'streak':
      return <Flame className="h-4 w-4 text-orange-500" />;
    default:
      return <Info className="h-4 w-4 text-sky-500" />;
  }
}

function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso));
}

export function NotificationBell() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useAuth();

  const hasUnread = unreadNotificationCount > 0;

  const grouped = useMemo(() => {
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    for (const n of notifications) {
      const isToday =
        n.date === new Date().toISOString().slice(0, 10);
      if (isToday) today.push(n);
      else earlier.push(n);
    }
    return { today, earlier };
  }, [notifications]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 sm:w-96"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notifications</span>
            {hasUnread && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadNotificationCount} new
              </span>
            )}
          </div>
          {hasUnread && (
            <button
              onClick={markAllNotificationsRead}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">
              Daily mood reminders will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-1 p-2">
              {grouped.today.length > 0 && (
                <GroupLabel label="Today" />
              )}
              {grouped.today.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onRead={markNotificationRead}
                />
              ))}
              {grouped.earlier.length > 0 && (
                <GroupLabel label="Earlier" />
              )}
              {grouped.earlier.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onRead={markNotificationRead}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearNotifications}
              className="w-full justify-center text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
  );
}

function NotificationItem({
  notif,
  onRead,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
}) {
  const isReminder = notif.kind === 'reminder';
  return (
    <Link
      href={isReminder ? '/app/today' : '/app/insights'}
      onClick={() => onRead(notif.id)}
      className={cn(
        'flex gap-3 rounded-xl p-3 transition-colors hover:bg-muted/60',
        !notif.read && 'bg-primary/5',
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {iconForKind(notif.kind)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{notif.title}</p>
          {!notif.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {notif.body}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {timeAgo(notif.createdAt)}
        </p>
      </div>
    </Link>
  );
}
