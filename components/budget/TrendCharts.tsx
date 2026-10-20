"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { buildCategoryTrend, buildSavingsRate, formatCurrency } from "@/lib/budget/calculations";
import { usePeriodStart } from "@/lib/budget/PeriodContext";
import type { FinTransaction, FinCategory } from "@/types/budget";

interface Props {
  allTransactions: FinTransaction[];
  categories: FinCategory[];
  currency: string;
}

const RANGES = [6, 12] as const;

function shortK(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export default function TrendCharts({ allTransactions, categories, currency }: Props) {
  const startDay = usePeriodStart();
  const [months, setMonths] = useState<6 | 12>(6);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const trend = useMemo(() => buildCategoryTrend(allTransactions, categories, months, 6, startDay), [allTransactions, categories, months, startDay]);
  const savings = useMemo(() => buildSavingsRate(allTransactions, months, startDay), [allTransactions, months, startDay]);

  const visible = trend.series.filter((s) => !hidden.has(s.id));
  const rated = savings.filter((p) => p.rate !== null);
  const avg = rated.length ? rated.reduce((s, p) => s + (p.rate as number), 0) / rated.length : null;
  const latest = rated.length ? rated[rated.length - 1] : null;

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pill = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
      active
        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-900/60 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setMonths(r)} className={pill(months === r)}>{r}M</button>
          ))}
        </div>
      </div>

      {/* ── Category trend ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          Category Trend (monthly spend)
        </p>
        {trend.series.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">No expenses in this period.</p>
        ) : (
          <>
            <div style={{ width: "100%", height: 260 }} className="mt-2">
              <ResponsiveContainer>
                <BarChart data={trend.rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" tickLine={false} />
                  <YAxis tickFormatter={shortK} tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={44} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.15)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const items = payload.filter((p) => Number(p.value) > 0).sort((a, b) => Number(b.value) - Number(a.value));
                      const total = items.reduce((s, p) => s + Number(p.value), 0);
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                          <p className="font-semibold text-gray-900 dark:text-white">{label} · {formatCurrency(total, currency)}</p>
                          {items.map((p) => (
                            <p key={String(p.dataKey)} style={{ color: p.color }}>
                              {p.name}: {formatCurrency(Number(p.value), currency)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {visible.map((s) => (
                    <Bar key={s.id} dataKey={s.id} name={s.name} stackId="a" fill={s.color} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {trend.series.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 ${hidden.has(s.id) ? "opacity-40" : ""}`}
                  title={hidden.has(s.id) ? "Show" : "Hide"}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
              Subcategories are rolled into their parent. Tap a category to hide it.
            </p>
          </>
        )}
      </div>

      {/* ── Savings rate ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Savings Rate</p>
        <div className="mt-1 flex items-baseline gap-3 flex-wrap">
          <span className={`text-2xl font-bold ${latest && (latest.rate as number) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {latest ? `${(latest.rate as number).toFixed(1)}%` : "—"}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {latest ? `${latest.label} · ` : ""}{avg !== null ? `avg ${avg.toFixed(1)}% over ${rated.length} month${rated.length !== 1 ? "s" : ""}` : "no income recorded yet"}
          </span>
        </div>
        <div style={{ width: "100%", height: 220 }} className="mt-2">
          <ResponsiveContainer>
            <LineChart data={savings} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={48} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 3" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof savings)[number];
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.label}</p>
                      <p className="text-gray-700 dark:text-gray-200">
                        Rate: {p.rate === null ? "no income" : `${p.rate.toFixed(1)}%`}
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400">Income: {formatCurrency(p.income, currency)}</p>
                      <p className="text-red-600 dark:text-red-400">Expense: {formatCurrency(p.expense, currency)}</p>
                      <p className="text-gray-500 dark:text-gray-400">Saved: {formatCurrency(p.saved, currency)}</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          (Income − expense) ÷ income. Below the dashed line means you spent more than you earned that month; transfers are ignored.
        </p>
      </div>
    </div>
  );
}
