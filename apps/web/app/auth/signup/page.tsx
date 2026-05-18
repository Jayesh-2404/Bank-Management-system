"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";

export default function SignUpPage() {
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
          <h1 className="mt-16 text-3xl font-bold leading-tight">Join the platform</h1>
          <p className="mt-4 text-base text-white/60 leading-relaxed">
            Sign up to access your bank account, manage finances, and use all banking services securely.
          </p>
        </div>
        <div className="grid gap-5 p-10">
          <div>
            <h2 className="text-3xl font-bold text-ink tracking-tight">Sign up</h2>
            <p className="mt-2 text-sm text-muted">Contact your bank administrator to create an account.</p>
          </div>
          <div className="rounded-md border border-line p-5 text-sm text-muted">
            <p className="font-semibold text-ink">For demo purposes:</p>
            <p className="mt-3">Customer accounts are created by bank staff (Teller / Branch Manager).</p>
            <p className="mt-2">Use the sign-in page to access demo accounts.</p>
          </div>
          <Link href="/auth/signin" className="text-sm text-teal-600 hover:text-teal-700 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}