import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { branches } from "@/lib/demo";
import { demoBanks, formatCurrency } from "@bank/shared";

export default function AdminPage() {
  return (
    <AppShell title="Administration" description="Manage banks, branches, staff roles, policies, thresholds, and platform configuration." active="/admin">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">Banks registry</h2>
          <DataTable
            columns={["Name", "Code", "Status", "Deposits", "Loan book"]}
            rows={demoBanks.map((bank) => ({
              Name: bank.name,
              Code: bank.code,
              Status: bank.status,
              Deposits: formatCurrency(bank.deposits),
              "Loan book": formatCurrency(bank.loansOutstanding)
            }))}
          />
        </div>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-semibold">Branches and IFSC</h2>
          <DataTable columns={["id", "name", "ifsc", "manager", "volume"]} rows={branches} />
        </div>
        <div className="panel p-5 xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Policy defaults</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Daily transfer limit", "₹50,000"],
              ["Transfer approval", "₹50,000"],
              ["Inter-bank approval", "₹25,000"],
              ["KYC cooldown", "30 days"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-4">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
