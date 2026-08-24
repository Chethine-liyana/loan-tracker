"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { dailyCost, formatLKR } from "@/lib/calculations";
import type { Loan } from "@/types";

interface Props {
  loans: Loan[];
}

const PIE_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                    rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 dark:text-white">{p.payload.name}</p>
      <p className="text-gray-500 dark:text-gray-400">{formatLKR(p.value)}</p>
    </div>
  );
}

export default function PortfolioCharts({ loans }: Props) {
  if (loans.length === 0) return null;

  const pieData = loans
    .map((l) => ({
      name: `${l.bank_name}${l.ticket_no ? ` #${l.ticket_no}` : ""}`,
      value: l.current_principal_remaining,
    }))
    .filter((d) => d.value > 0);

  const barData = loans
    .map((l) => ({
      name: l.bank_name.length > 10 ? l.bank_name.slice(0, 10) + "…" : l.bank_name,
      fullName: `${l.bank_name}${l.ticket_no ? ` #${l.ticket_no}` : ""}`,
      daily: dailyCost(l.current_principal_remaining, l.annual_interest_rate),
    }))
    .sort((a, b) => b.daily - a.daily);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      {/* ── Principal distribution ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
          Principal by Account
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-center">
          {pieData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="truncate max-w-[120px]">{d.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily interest burn per account ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
          Daily Interest by Account
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-gray-500 dark:text-gray-400"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={45}
              />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={44} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                    rounded-lg shadow-lg px-3 py-2 text-xs">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.fullName}</p>
                      <p className="text-orange-600 dark:text-orange-400">{formatLKR(p.daily)} / day</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="daily" radius={[6, 6, 0, 0]} fill="#f97316" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
