"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { api, getStoredUser } from "@/lib/api";
import { type Role } from "@bank/shared";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    api.getNotifications().then((result) => setNotifications(result.data ?? []));
  }, [router]);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }

  async function markAllRead() {
    const unread = notifications.filter((item) => !item.isRead);
    await Promise.all(unread.map((item) => api.markNotificationRead(item.id)));
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
  }

  return (
    <AppShell title="Notifications" description="Workflow inbox for KYC, transfers, loan decisions, and limit requests." active="/notifications" role={user?.role as Role | undefined}>
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <Button type="button" variant="outline" onClick={markAllRead} disabled={notifications.every((item) => item.isRead)}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
        <div className="grid gap-3">
          {notifications.length === 0 ? (
            <div className="rounded-md border border-line bg-slate-50 p-6 text-sm text-muted">No notifications yet.</div>
          ) : notifications.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-md border border-line bg-white p-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-amber-400" /> : null}
                  <p className="font-semibold">{item.title}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{item.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted">{new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                {!item.isRead ? (
                  <Button type="button" variant="subtle" className="px-3 py-2" onClick={() => markRead(item.id)}>
                    Read
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
