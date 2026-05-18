import { AppShell } from "@/components/app-shell";
import { PipelineBarChart, VolumeLineChart } from "@/components/charts";
import { MetricCard } from "@/components/metric-card";
import { volumeSeries } from "@/lib/demo";

export default function ReportsPage() {
  return (
    <AppShell title="Reports" description="Analytics for transaction volume, deposit movement, branch performance, loan pipeline, and exceptions." active="/reports">
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Statement runs" value="1,284" trend="+6.3%" tone="blue" />
          <MetricCard label="Failed transfers" value="11" trend="3 urgent" tone="red" />
          <MetricCard label="Delinquency bucket" value="2.4%" trend="-0.4%" tone="teal" />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="panel p-5">
            <h2 className="mb-4 text-lg font-semibold">Deposits vs withdrawals</h2>
            <div className="h-80">
              <VolumeLineChart {...volumeSeries} />
            </div>
          </div>
          <div className="panel p-5">
            <h2 className="mb-4 text-lg font-semibold">Loan pipeline</h2>
            <div className="h-80">
              <PipelineBarChart />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
