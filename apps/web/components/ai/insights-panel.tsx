"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2, AlertCircle, BarChart3 } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { ai, type AgentInsights } from "@/lib/ai";

export function InsightsPanel() {
  const [insights, setInsights] = useState<AgentInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInsights() {
    setLoading(true);
    setError(null);
    const res = await ai.getInsights();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setInsights(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Last updated: {new Date(insights.generatedAt).toLocaleString("en-IN")}</p>
        <Button variant="subtle" onClick={loadInsights}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {insights.metrics.map((m, i) => (
          <MetricCard key={i} label={m.label} value={m.value} trend={m.trend} tone={m.tone} />
        ))}
      </div>

      {insights.anomalies.length > 0 && (
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-ink">Alerts & Anomalies</h3>
          </div>
          <div className="space-y-3">
            {insights.anomalies.map((a, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4",
                  a.severity === "high" ? "border-red-200 bg-red-50" : a.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{a.title}</p>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
                      a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.anomalies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-teal-500/30" />
          <p className="text-sm font-semibold text-ink">All clear</p>
          <p className="mt-1 text-sm text-muted">No anomalies or alerts detected</p>
        </div>
      )}
    </div>
  );
}
