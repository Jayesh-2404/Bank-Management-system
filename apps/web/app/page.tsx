"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Landmark, ArrowRight, Users, ShieldCheck, BadgeIndianRupee, Send, LayoutDashboard, LockKeyhole } from "lucide-react";
import { roleLabels, type Role } from "@bank/shared";
import { getStoredUser } from "@/lib/api";

const roles: { role: Role; description: string; email: string }[] = [
  { role: "PlatformAdmin", description: "Platform-wide management", email: "platform@bancuip.test" },
  { role: "BankAdmin", description: "Bank operations", email: "admin@meridian.test" },
  { role: "BranchManager", description: "Branch operations", email: "manager@meridian.test" },
  { role: "Teller", description: "Cash operations", email: "teller@meridian.test" },
  { role: "LoanOfficer", description: "Loan management", email: "loan@meridian.test" },
  { role: "Auditor", description: "Audit & compliance", email: "auditor@meridian.test" },
  { role: "Customer", description: "Self-service banking", email: "customer@meridian.test" }
];

const stats = [
  { value: "50+", label: "Active Banks" },
  { value: "12K+", label: "Accounts" },
  { value: "₹85Cr", label: "Daily Volume" },
  { value: "99.9%", label: "Uptime" }
];

const features = [
  { icon: LayoutDashboard, title: "Multi-tenant Architecture", desc: "Complete data isolation per bank with tenant-scoped records." },
  { icon: LockKeyhole, title: "Double-entry Ledger", desc: "Every transaction recorded as balanced debit/credit journal entries." },
  { icon: ShieldCheck, title: "Role-based Access", desc: "7 roles with hierarchical permissions and JWT authentication." },
  { icon: Users, title: "KYC Management", desc: "Document collection, verification workflow, and compliance tracking." },
  { icon: BadgeIndianRupee, title: "Loan Processing", desc: "End-to-end loan applications with approval workflows." },
  { icon: Send, title: "Real-time Transfers", desc: "Instant transfers with IFSC, handle, and account number support." }
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
    <main className="min-h-screen flex flex-col bg-[#fafaf8]">
      <header className="bg-white border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold text-ink">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>
          <Link href="/auth/signin" className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700">
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative bg-slate-900 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
            Multi-tenant Bank Management
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
            Secure platform for banks with role-based access, ledger accounting, KYC, loans, and real-time transfers.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/signin" className="flex items-center gap-2 rounded-md bg-teal-600 px-8 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features" className="flex items-center gap-2 rounded-md border border-white/20 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
              Learn More
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="panel p-6 text-center">
                <p className="text-3xl font-bold text-ink md:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-ink md:text-3xl">Platform Features</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="panel p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-ink">{feat.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-ink md:text-3xl">Demo Access</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((item) => (
              <Link
                key={item.role}
                href={`/auth/signin?demo=${item.role}`}
                className="panel group p-5 transition hover:border-teal-500 hover:shadow-panel cursor-pointer"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink">{roleLabels[item.role]}</h3>
                  <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-teal-600" />
                </div>
                <p className="text-sm text-muted">{item.description}</p>
                <p className="mt-2 text-xs text-teal-600">{item.email}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-ink md:text-3xl">Architecture Highlights</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="panel p-6">
              <p className="text-base font-semibold text-ink">Multi-tenant</p>
              <p className="mt-2 text-sm text-muted leading-relaxed">Every record scoped by bank_id. Complete data isolation per tenant.</p>
            </div>
            <div className="panel p-6">
              <p className="text-base font-semibold text-ink">Double-entry Ledger</p>
              <p className="mt-2 text-sm text-muted leading-relaxed">All money movements recorded as journal entries with balanced debits/credits.</p>
            </div>
            <div className="panel p-6">
              <p className="text-base font-semibold text-ink">RBAC + JWT</p>
              <p className="mt-2 text-sm text-muted leading-relaxed">7 roles with hierarchical permissions. Secure token-based authentication.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-line bg-slate-900 px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-white/60">
          Bancuip Bank Management System
        </div>
      </footer>
    </main>
  );
}