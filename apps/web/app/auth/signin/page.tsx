"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { Button } from "@/components/button";
import { roleLabels } from "@bank/shared";
import { login } from "@/lib/api";

const demoIdentities: Record<string, { email: string; loginType: "STAFF" | "CUSTOMER" }> = {
  PlatformAdmin: { email: "platform@bancuip.test", loginType: "STAFF" },
  BankAdmin: { email: "admin@meridian.test", loginType: "STAFF" },
  BranchManager: { email: "manager@meridian.test", loginType: "STAFF" },
  Teller: { email: "teller@meridian.test", loginType: "STAFF" },
  LoanOfficer: { email: "loan@meridian.test", loginType: "STAFF" },
  Auditor: { email: "auditor@meridian.test", loginType: "STAFF" },
  Customer: { email: "customer@meridian.test", loginType: "CUSTOMER" }
};

export default function SignInPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<"STAFF" | "CUSTOMER">("STAFF");
  const [identifier, setIdentifier] = useState("admin@meridian.test");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#fafaf8]">
      <div className="surface grid w-full max-w-5xl overflow-hidden md:grid-cols-[1fr_1.2fr]">
        <div className="bg-slate-900 p-10 text-white">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-900">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>
          <h1 className="mt-16 text-3xl font-bold leading-tight">Secure access for every banking role</h1>
          <p className="mt-4 text-base text-white/60 leading-relaxed">
            Use the listed demo identifiers. Tokens, roles, tenant scope, and branch scope are handled by the API.
          </p>
          <div className="mt-8 rounded-md border border-white/20 p-4 text-sm text-white/80">
            <p className="font-semibold text-white">Demo password:</p>
            <p className="mt-1">Password123!</p>
          </div>
        </div>
        <form className="grid gap-5 p-10" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-3xl font-bold text-ink tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm text-muted">Choose a demo role now; replace credentials in <code>.env</code> later.</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <label className="label" htmlFor="loginType">Login type</label>
            <select
              id="loginType"
              className="field"
              value={loginType}
              onChange={(e) => setLoginType(e.target.value as "STAFF" | "CUSTOMER")}
            >
              <option value="STAFF">STAFF</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="label" htmlFor="email">Email or phone</label>
            <input
              id="email"
              className="field"
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          <div className="grid gap-2 rounded-md border border-line p-4">
            <p className="text-sm font-semibold text-ink">Demo identities</p>
            {Object.entries(demoIdentities).map(([role, identity]) => (
              <div key={role} className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{roleLabels[role as keyof typeof roleLabels]}</span>
                <button
                  type="button"
                  className="font-mono hover:text-teal-600"
                  onClick={() => {
                    setIdentifier(identity.email);
                    setLoginType(identity.loginType);
                  }}
                >
                  {identity.email}
                </button>
              </div>
            ))}
          </div>
        </form>
      </div>
    </main>
  );
}
