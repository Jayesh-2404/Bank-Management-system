"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { Button } from "@/components/button";
import { login } from "@/lib/api";
import { cn } from "@/lib/utils";

type LoginType = "STAFF" | "CUSTOMER";

export default function SignInPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<LoginType>("CUSTOMER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectLoginType(nextLoginType: LoginType) {
    setLoginType(nextLoginType);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(identifier, password, loginType);

    if (result.error || !result.data) {
      setError(result.error || "Login failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  const isCustomer = loginType === "CUSTOMER";

  return (
    <main className="flex min-h-screen items-center justify-center bg-teal-50 p-4">
      <form className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-panel sm:p-8" onSubmit={handleSubmit}>
        <div className="text-center">
          <Link href="/" className="mx-auto flex w-fit items-center gap-3 text-lg font-bold text-ink">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>
          <p className={cn("mt-6 text-xs font-semibold uppercase tracking-[0.16em]", isCustomer ? "text-teal-600" : "text-slate-700")}>
            {isCustomer ? "Customer Banking" : "Staff Portal"}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">Sign in</h1>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-semibold transition",
              !isCustomer ? "bg-slate-900 text-white shadow-soft" : "text-slate-600 hover:text-ink"
            )}
            onClick={() => selectLoginType("STAFF")}
          >
            Staff Login
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-semibold transition",
              isCustomer ? "bg-teal-600 text-white shadow-soft" : "text-slate-600 hover:text-ink"
            )}
            onClick={() => selectLoginType("CUSTOMER")}
          >
            Customer Login
          </button>
        </div>

        {isCustomer ? <CustomerLoginPreview /> : <StaffLoginPreview />}

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <input type="hidden" name="loginType" value={loginType} />

        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <label className="label" htmlFor="identifier">
              {isCustomer ? "Identifier" : "Email identifier"}
            </label>
            <input
              id="identifier"
              className="field"
              placeholder={isCustomer ? "customer@example.com" : "staff@example.com"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className={cn("w-full", isCustomer ? "bg-teal-600 hover:bg-teal-700" : "bg-slate-900 hover:bg-slate-800 focus:ring-slate-900/20")} disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          {isCustomer && (
            <p className="text-center text-sm text-muted">
              New customer?{" "}
              <Link href="/auth/signup" className="font-semibold text-teal-700 hover:text-teal-800 hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </div>
      </form>
    </main>
  );
}

function CustomerLoginPreview() {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-teal-100 bg-teal-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-teal-700 shadow-soft">
              <WalletCards className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Prime Savings</p>
              <p className="text-xs text-slate-600">Amanda Kayle</p>
            </div>
          </div>
          <p className="mt-5 text-3xl font-bold tracking-normal text-slate-950">INR 98,450</p>
          <p className="mt-1 text-xs font-medium text-teal-700">Available balance</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-soft">Active</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-muted">Last transfer</p>
          <p className="mt-1 text-sm font-semibold text-ink">INR 12,000</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <p className="text-xs text-muted">Daily limit</p>
          <p className="mt-1 text-sm font-semibold text-ink">INR 2.5L</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/80 p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-700" />
          <p className="text-xs font-semibold text-slate-700">Protected by role-based customer access</p>
        </div>
      </div>
    </div>
  );
}

function StaffLoginPreview() {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-soft">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Secure staff portal</p>
          <p className="text-xs text-muted">Role-scoped operations for banking teams</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white p-3">
        <p className="text-xs font-semibold text-muted">Demo credentials</p>
        <div className="mt-2 space-y-1.5 text-xs text-ink">
          <p><span className="inline-block w-24 font-medium text-muted">BankAdmin:</span> admin@meridian.test</p>
          <p><span className="inline-block w-24 font-medium text-muted">BranchManager:</span> manager@meridian.test</p>
          <p><span className="inline-block w-24 font-medium text-muted">Teller:</span> teller@meridian.test</p>
          <p><span className="inline-block w-24 font-medium text-muted">LoanOfficer:</span> loan@meridian.test</p>
          <p><span className="inline-block w-24 font-medium text-muted">Auditor:</span> auditor@meridian.test</p>
          <p><span className="inline-block w-24 font-medium text-muted">PlatformAdmin:</span> platform@bancuip.test</p>
        </div>
        <p className="mt-2 text-xs text-muted">Password: <span className="font-semibold text-ink">Password123!</span></p>
      </div>
    </div>
  );
}
