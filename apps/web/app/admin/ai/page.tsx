"use client";

import { useState } from "react";
import { MessageSquareText, Search, BarChart3, Bot } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { ChatPanel } from "@/components/ai/chat-panel";
import { SearchPanel } from "@/components/ai/search-panel";
import { InsightsPanel } from "@/components/ai/insights-panel";

type Tab = "chat" | "search" | "insights";

const tabs: Array<{ id: Tab; label: string; icon: typeof MessageSquareText }> = [
  { id: "chat", label: "AI Chat", icon: MessageSquareText },
  { id: "search", label: "Smart Search", icon: Search },
  { id: "insights", label: "Analytics", icon: BarChart3 }
];

export default function AiAgentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <AppShell
      title="AI Agent"
      description="Natural language queries, smart search, and business analytics powered by AI"
      active="/admin/ai"
    >
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-white p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
                isActive ? "bg-teal-600 text-white shadow-soft" : "text-muted hover:bg-slate-50 hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "chat" && <ChatPanel />}
      {activeTab === "search" && <SearchPanel />}
      {activeTab === "insights" && <InsightsPanel />}
    </AppShell>
  );
}
