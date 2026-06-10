"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/button";
import { DataTable, StatusBadge } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { ai, type AgentResult } from "@/lib/ai";

interface Message {
  role: "user" | "assistant";
  content: string;
  result?: AgentResult | undefined;
  error?: string | undefined;
}

function ResultView({ result }: { result: AgentResult }) {
  if (!result.data || result.data.length === 0) {
    return <p className="text-sm text-muted">No data returned</p>;
  }

  if (result.intent === "GET_COUNT" && result.data[0]) {
    const counts = result.data[0] as Record<string, number>;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted">{key.replace(/([A-Z])/g, " $1").trim()}</p>
            <p className="mt-1 text-lg font-semibold text-ink">{val.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    );
  }

  if (result.intent === "ANOMALY" && result.data[0]) {
    const anomalies = result.data as Array<{ type: string; severity: string; title: string; description: string; count: number }>;
    return (
      <div className="space-y-3">
        {anomalies.map((a, i) => (
          <div key={i} className={cn("rounded-lg border p-4", a.severity === "high" ? "border-red-200 bg-red-50" : a.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50")}>
            <div className="flex items-center gap-2">
              <AlertCircle className={cn("h-4 w-4", a.severity === "high" ? "text-red-500" : a.severity === "medium" ? "text-amber-500" : "text-blue-500")} />
              <p className="font-semibold text-ink">{a.title}</p>
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>{a.severity}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{a.description}</p>
          </div>
        ))}
      </div>
    );
  }

  const data = result.data as Array<Record<string, unknown>>;
  if (data.length === 0) return null;

  const cols = Object.keys(data[0]!).filter((k) => k !== "id");
  return (
    <DataTable
      columns={cols.map((c) => c.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()))}
      rows={data.slice(0, 10).map((row) => {
        const r: Record<string, React.ReactNode> = {};
        for (const c of cols) {
          const v = row[c];
          if (c === "status" || c === "accountStatus") {
            r[c] = <StatusBadge status={String(v)} />;
          } else if (typeof v === "number") {
            r[c] = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
          } else {
            r[c] = String(v ?? "-");
          }
        }
        return r;
      })}
    />
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your banking AI assistant. Ask me anything about customers, accounts, transactions, KYC cases, loans, or just type 'show insights' for a business overview."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    const res = await ai.query(q);
    if (res.error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "", error: res.error }]);
    } else if (res.data) {
      setMessages((prev) => [...prev, { role: "assistant", content: res.data!.response, result: res.data }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-line bg-white">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div className={cn("max-w-[80%] space-y-3", msg.role === "user" && "order-1")}>
                <div className={cn("rounded-xl px-4 py-3", msg.role === "user" ? "bg-teal-600 text-white" : msg.error ? "bg-red-50 text-red-700" : "bg-slate-50 text-ink")}>
                  {msg.error ? (
                    <p className="text-sm">{msg.error}</p>
                  ) : (
                    msg.content && <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                {msg.result && (
                  <div className="rounded-xl border border-line bg-white p-4">
                    <ResultView result={msg.result} />
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <Bot className="h-4 w-4" />
              </span>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-3 border-t border-line p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your bank data..."
          className="flex-1 rounded-lg border border-line bg-slate-50 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          disabled={loading}
        />
        <Button type="submit" variant="primary" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
