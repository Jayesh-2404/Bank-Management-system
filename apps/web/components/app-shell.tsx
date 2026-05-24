"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardCheck,
  FileBarChart,
  Landmark,
  LayoutDashboard,
  BadgeIndianRupee,
  LockKeyhole,
  LogOut,
  Logs,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  ShieldCheck,
  X,
  Users,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { roleLabels, type Role } from "@bank/shared";
import { getStoredUser, logout, api } from "@/lib/api";

const navItems: Array<{ href: string; label: string; icon: LucideIcon; roles: Role[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["PlatformAdmin", "BankAdmin", "BranchManager", "Customer", "Auditor"] },
  { href: "/accounts", label: "Accounts", icon: WalletCards, roles: ["BankAdmin", "BranchManager", "Teller", "Customer"] },
  { href: "/transfers", label: "Transfers", icon: Send, roles: ["BankAdmin", "BranchManager", "Teller", "Customer"] },
  { href: "/kyc", label: "KYC", icon: ShieldCheck, roles: ["BankAdmin", "BranchManager", "Customer", "Auditor"] },
  { href: "/limits", label: "Limits", icon: LockKeyhole, roles: ["BankAdmin", "BranchManager", "Customer"] },
  { href: "/loans", label: "Loans", icon: BadgeIndianRupee, roles: ["BankAdmin", "BranchManager", "LoanOfficer", "Customer"] },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck, roles: ["BankAdmin", "BranchManager", "LoanOfficer"] },
  { href: "/teller", label: "Teller", icon: Users, roles: ["Teller", "BranchManager", "BankAdmin"] },
  { href: "/reports", label: "Reports", icon: FileBarChart, roles: ["PlatformAdmin", "BankAdmin", "BranchManager", "Auditor"] },
  { href: "/ledger", label: "Ledger", icon: Landmark, roles: ["BankAdmin", "BranchManager", "Auditor"] },
  { href: "/audit", label: "Audit", icon: Logs, roles: ["PlatformAdmin", "BankAdmin", "BranchManager", "Auditor"] },
  { href: "/admin", label: "Admin", icon: Building2, roles: ["PlatformAdmin", "BankAdmin"] }
];

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  description: string;
  active?: string;
  role?: Role | undefined;
}

export function AppShell({ children, title, description, active = "/dashboard", role: initialRole }: AppShellProps) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole ?? "BankAdmin");
  const [user, setUser] = useState<{ displayName: string; bankName?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/auth/signin");
      return;
    }
    setUser(storedUser);
    setRole((storedUser.role as Role) || initialRole || "BankAdmin");

    api.getUnreadCount().then((result) => {
      if (typeof result.data?.count === "number") {
        setUnreadCount(result.data.count);
      }
    });

    const interval = setInterval(() => {
      api.getUnreadCount().then((result) => {
        if (typeof result.data?.count === "number") {
          setUnreadCount(result.data.count);
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [router, initialRole]);

  function handleLogout() {
    logout();
    router.push("/auth/signin");
  }

  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="border-b border-white/10 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-900">
              <Landmark className="h-5 w-5" />
            </span>
            <span className={`text-lg font-bold text-white transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}>
              bancuip
            </span>
          </div>
          {!sidebarCollapsed && (
            <div className="mt-5">
              <p className="truncate text-sm font-semibold text-white">{user?.displayName || "User"}</p>
              <span className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                {roleLabels[role]}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-3">
          <nav className="grid gap-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-950 shadow-soft"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className={`transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            title={sidebarCollapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={`transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}>
              Sign out
            </span>
          </button>
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 transition hover:bg-white/10 hover:text-white"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative z-10 flex h-full w-72 flex-col bg-slate-950">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-900">
                  <Landmark className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold text-white">bancuip</span>
                <button className="ml-auto rounded-lg bg-white/10 p-2 text-white" onClick={() => setMobileSidebarOpen(false)} title="Close menu">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5">
                <p className="truncate text-sm font-semibold text-white">{user?.displayName || "User"}</p>
                <span className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                  {roleLabels[role]}
                </span>
              </div>
            </div>
            <nav className="grid flex-1 gap-1 overflow-y-auto p-3">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-white text-slate-950"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-white/95 px-5 py-3 backdrop-blur md:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <button className="rounded-lg bg-slate-100 p-2 lg:hidden" onClick={() => setMobileSidebarOpen(true)} title="Open menu">
              <Menu className="h-5 w-5 text-ink" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-600">{user?.bankName || "Bank"}</p>
              <h1 className="mt-0.5 truncate text-xl font-bold text-ink md:text-2xl">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/notifications" className="relative rounded-lg border border-line bg-white p-3 hover:bg-slate-50" title="Notifications">
              <Bell className="h-5 w-5 text-muted" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="relative">
              <button
                className="flex items-center gap-3 rounded-lg border border-line bg-white py-2 pl-1 pr-4 hover:bg-slate-50"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-700">
                  {initials}
                </span>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-semibold text-ink">{user?.displayName || "User"}</p>
                  <p className="text-xs text-muted">{roleLabels[role]}</p>
                </div>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-line bg-white py-2 shadow-panel">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-sm font-semibold text-ink">{user?.displayName}</p>
                    <p className="mt-0.5 text-xs text-muted">{user?.bankName}</p>
                  </div>
                  <button
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-slate-50"
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="p-5 md:p-7">
          <p className="mb-5 text-sm text-muted">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
