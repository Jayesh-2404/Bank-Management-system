import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { transactions } from "@/lib/demo";
import { formatCurrency } from "@bank/shared";

export default function LedgerPage() {
  return (
    <AppShell title="Ledger" description="Read-only journal view for auditor and management review." active="/ledger">
      <div className="panel p-5">
        <DataTable
          columns={["Reference", "Entry type", "Debit", "Credit", "Amount", "Status"]}
          rows={transactions.map((tx) => ({
            Reference: tx.id.slice(0, 8).toUpperCase(),
            "Entry type": tx.type,
            Debit: tx.type === "DEPOSIT" ? "Cash on Hand" : "Customer Deposit Liability",
            Credit: tx.type === "DEPOSIT" ? "Customer Deposit Liability" : "Settlement / Cash",
            Amount: formatCurrency(tx.amount),
            Status: tx.status
          }))}
        />
      </div>
    </AppShell>
  );
}
