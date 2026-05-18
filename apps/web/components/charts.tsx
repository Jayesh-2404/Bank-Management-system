"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

export function VolumeLineChart({ labels, deposits, withdrawals }: { labels: string[]; deposits: number[]; withdrawals: number[] }) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Deposits",
            data: deposits,
            borderColor: "#079678",
            backgroundColor: "rgba(7, 150, 120, 0.12)",
            fill: true,
            tension: 0.42,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "Withdrawals",
            data: withdrawals,
            borderColor: "#f7b731",
            backgroundColor: "rgba(247, 183, 49, 0.10)",
            fill: false,
            tension: 0.42,
            pointRadius: 4
          }
        ]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: "#080b1a", padding: 12, cornerRadius: 4 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b" } },
          y: { border: { display: false }, grid: { color: "#e5e7eb" }, ticks: { color: "#64748b" } }
        }
      }}
    />
  );
}

export function PipelineBarChart() {
  return (
    <Bar
      data={{
        labels: ["Submitted", "Review", "Approved", "Disbursed"],
        datasets: [
          {
            label: "Loan pipeline",
            data: [18, 11, 7, 5],
            backgroundColor: ["#ccfbf1", "#475569", "#079678", "#f7b731"],
            borderRadius: 4
          }
        ]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b" } },
          y: { border: { display: false }, grid: { color: "#e5e7eb" }, ticks: { precision: 0, color: "#64748b" } }
        }
      }}
    />
  );
}