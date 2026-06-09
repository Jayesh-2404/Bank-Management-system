"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  Building2,
  ClipboardCheck,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Network,
  Send,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { getStoredUser } from "@/lib/api";

const staffRoles = [
  { label: "Platform Admin", description: "Platform-wide tenant and bank management" },
  { label: "Bank Admin", description: "Bank operations, products, reports, and controls" },
  { label: "Branch Manager", description: "Branch operations, approvals, and account oversight" },
  { label: "Teller", description: "Cash counter operations and customer servicing" },
  { label: "Loan Officer", description: "Loan pipeline review and application handling" },
  { label: "Auditor", description: "Read-only compliance and transaction monitoring" }
];

const customerRole = {
  label: "Customer",
  description: "Personal account access, transfers, KYC, limits, and loans."
};

const stats = [
  { value: "50+", label: "Active Banks" },
  { value: "12K+", label: "Accounts" },
  { value: "INR 85Cr", label: "Daily Volume" },
  { value: "99.9%", label: "Uptime" }
];

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: LayoutDashboard, title: "Multi-tenant Architecture", desc: "Complete data isolation per bank with tenant-scoped records." },
  { icon: LockKeyhole, title: "Double-entry Ledger", desc: "Every transaction recorded as balanced debit and credit journal entries." },
  { icon: ShieldCheck, title: "Role-based Access", desc: "Seven roles with hierarchical permissions and JWT authentication." },
  { icon: Users, title: "KYC Management", desc: "Document collection, verification workflow, and compliance tracking." },
  { icon: BadgeIndianRupee, title: "Loan Processing", desc: "End-to-end loan applications with approval workflows." },
  { icon: Send, title: "Real-time Transfers", desc: "Instant transfers with IFSC, handle, and account number support." }
];

const architecture: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Building2, title: "Tenant Isolation", desc: "Bank-scoped records keep institutions separated." },
  { icon: WalletCards, title: "Ledger Core", desc: "Balanced entries back every money movement." },
  { icon: ShieldCheck, title: "Auditable Access", desc: "JWT roles protect workflows and reporting." }
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-ink">
      <section className="relative overflow-hidden border-b border-line bg-white px-6 py-6">
        <header className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>
          <Link href="/auth/signin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-700">
            Staff Login <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-14 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              <span className="h-px w-8 bg-teal-500" />
              Multi-tenant Banking Platform
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal text-slate-950 md:text-6xl">
              Banking operations, customer access, and compliance in one secure workspace.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Bancuip gives banks a modern operating layer for accounts, ledger activity, KYC, loans, approvals, and customer self-service.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20">
                Staff Portal <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-teal-500 hover:text-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20">
                Customer Login
              </Link>
            </div>
          </div>

          <div className="relative min-h-[360px]">
            <div className="absolute inset-0 rounded-[2rem] border border-slate-100 bg-slate-50" />
            <div className="absolute right-0 top-8 w-[88%] rounded-2xl border border-line bg-white p-5 shadow-panel">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Meridian Cooperative</p>
                  <p className="mt-1 text-xl font-semibold text-ink">Operations Console</p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">Live</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["KYC", "Loans", "Ledger"].map((label, index) => (
                  <div key={label} className="rounded-xl border border-line bg-slate-50 p-4">
                    <div className="mb-4 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-teal-500" style={{ width: `${64 + index * 12}%` }} />
                    </div>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-1 text-xs text-muted">{index + 4} reviews</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-line bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">Posted volume</p>
                    <p className="mt-1 text-2xl font-bold text-ink">INR 54.2L</p>
                  </div>
                  <Network className="h-10 w-10 text-teal-600" />
                </div>
                <div className="mt-5 flex h-24 items-end gap-2">
                  {[42, 58, 50, 74, 68, 86, 78, 96].map((height, index) => (
                    <span key={index} className="flex-1 rounded-t-md bg-teal-500/70" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-6 left-0 w-64 rounded-2xl border border-line bg-white p-5 text-slate-950 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Customer Wallet</p>
              <p className="mt-4 text-3xl font-bold">INR 98,450</p>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-muted">Prime Savings</span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="text-3xl font-bold text-ink md:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Platform Features</p>
            <h2 className="mt-3 text-3xl font-bold text-ink md:text-4xl">Built for real banking workflows.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="panel flex gap-5 p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{feat.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Secure Access</p>
            <h2 className="mt-3 text-3xl font-bold text-ink md:text-4xl">For Banking Staff</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {staffRoles.map((item) => (
              <Link
                key={item.label}
                href="/auth/signin"
                className="group rounded-xl border border-line bg-white p-5 shadow-soft transition hover:border-teal-500 hover:shadow-panel"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-ink">{item.label}</h3>
                  <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-teal-600" />
                </div>
                <p className="min-h-10 text-sm leading-relaxed text-muted">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Secure Access</p>
            <h2 className="mt-3 text-3xl font-bold text-ink md:text-4xl">For Customers</h2>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-6 shadow-soft md:flex md:items-center md:justify-between md:gap-8">
            <div>
              <p className="text-xl font-bold text-ink">{customerRole.label}</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">{customerRole.description}</p>
            </div>
            <Link href="/auth/signin" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20 md:mt-0">
              Customer Login <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-600">Architecture</p>
            <h2 className="mt-3 text-3xl font-bold text-ink md:text-4xl">A compact core for secure operations.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {architecture.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="panel p-6">
                  <Icon className="h-6 w-6 text-teal-600" />
                  <p className="mt-5 text-base font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-950">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>
          <p className="text-sm text-white/55">Copyright 2026 Bancuip Bank Management System</p>
          <Link href="/auth/signin" className="text-sm font-semibold text-white/70 transition hover:text-white">
            Staff Login
          </Link>
        </div>
      </footer>
    </main>
  );
}
