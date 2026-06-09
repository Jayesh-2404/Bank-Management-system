"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Landmark, ShieldCheck, UserPlus, WalletCards } from "lucide-react";
import { Button } from "@/components/button";
import { signupCustomer } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const result = await signupCustomer({ fullName, email, phone, password });

    if (result.error || !result.data) {
      setError(result.error || "Signup failed");
      setLoading(false);
      return;
    }

    router.push("/accounts");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-teal-50 p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-white shadow-panel md:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-slate-950 p-8 text-white sm:p-10">
          <Link href="/" className="flex w-fit items-center gap-3 text-lg font-bold">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
              <Landmark className="h-5 w-5" />
            </span>
            bancuip
          </Link>

          <div className="mt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Customer Banking</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-normal">Create your customer account</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              Signup is available only for customers. Staff access is created by bank administrators.
            </p>
          </div>

          <div className="mt-10 grid gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <WalletCards className="h-5 w-5 text-teal-300" />
              <span className="text-sm font-semibold text-white/85">Savings account opened automatically</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="h-5 w-5 text-teal-300" />
              <span className="text-sm font-semibold text-white/85">JWT session created after signup</span>
            </div>
          </div>
        </section>

        <form className="grid gap-5 p-6 sm:p-8" onSubmit={handleSubmit}>
          <div>
            <Link href="/auth/signin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-700">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-normal text-ink">Customer sign up</h2>
                <p className="mt-1 text-sm text-muted">Use this form only for customer access.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                className="field"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="field"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  className="field"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="label" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading}>
            {loading ? "Creating account..." : "Create customer account"}
          </Button>
        </form>
      </div>
    </main>
  );
}
