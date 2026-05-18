import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  teal: "bg-teal-50 text-teal-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-500",
  red: "bg-red-50 text-red-600"
};

export function MetricCard({ label, value, trend, tone = "teal" }: { label: string; value: string; trend: string; tone?: keyof typeof tones }) {
  const isDown = trend.includes("urgent") || trend.includes("-");
  const Icon = isDown ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-normal text-ink">{value}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-sm px-3 py-1 text-xs font-semibold", tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
          {trend}
        </span>
      </div>
    </div>
  );
}
