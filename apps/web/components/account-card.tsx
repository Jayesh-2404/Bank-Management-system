import Link from "next/link";
import { ArrowUpRight, FileText, LockKeyhole, Send, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@bank/shared";

interface AccountCardAccount {
  id?: string;
  accountNumber: string;
  publicHandle: string;
  product: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  availableBalance: number;
}

export function AccountCard({ account }: { account: AccountCardAccount }) {
  const accountId = account.id ?? "";
  const actions: Array<{ icon: LucideIcon; label: string; href: string }> = [
    { icon: Send, label: "Transfer", href: `/transfers${accountId ? `?from=${accountId}` : ""}` },
    { icon: FileText, label: "Statement", href: `/accounts${accountId ? `?account=${accountId}` : ""}` },
    { icon: LockKeyhole, label: "Limits", href: "/limits" },
    { icon: ArrowUpRight, label: "Details", href: `/accounts${accountId ? `?account=${accountId}` : ""}` }
  ];

  return (
    <div className="overflow-hidden rounded-md bg-slate-950 p-5 text-white shadow-soft ring-1 ring-white/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/75">{account.product}</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(account.availableBalance)}</p>
        </div>
        <div className="rounded-sm bg-white/20 px-3 py-1 text-xs font-semibold text-white">{account.status}</div>
      </div>
      <div className="mt-10 flex items-end justify-between">
        <div>
          <p className="text-xs text-white/70">Account</p>
          <p className="font-semibold">**** {account.accountNumber.slice(-4)}</p>
          <p className="mt-1 text-xs text-white/80">@{account.publicHandle}</p>
        </div>
        <p className="text-xl font-bold">VISA</p>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {actions.map(({ icon: Icon, label, href }) => (
          <Link key={label} href={href} className="flex h-12 items-center justify-center rounded-sm bg-white/[0.14] text-white transition hover:bg-white/[0.24]" title={label}>
            <Icon className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}
