"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from "recharts";
import {
  buildWeeklySpend, buildBudgetsWithSpend, calcWeeklyAllowance, formatCurrency,
} from "@/lib/budget/calculations";
import type { FinTransaction, FinCategory, FinBudget } from "@/types/budget";

interface Props {
  allTransactions: FinTransaction[];
  rawBudgets: FinBudget[];
  categories: FinCategory[];
  currency: string;
}

const now = new Date();
const PIE_COLORS_FALLBACK = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];
const BAR_COLOR = "#6366f1";
const BAR_COLOR_ACTIVE = "#f97316";

export default function WeeklySpendPanel({ allTransactions, rawBudgets, categories, currency }: Props) {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelectedWeek(null), [month, year]);

  // Dismiss the category breakdown when clicking anywhere outside this card.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSelectedWeek(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const weeks = useMemo(
    () => buildWeeklySpend(allTransactions, categories, month, year),
    [allTransactions, categories, month, year]
  );

  const budgetsThisMonth = useMemo(
    () => buildBudgetsWithSpend(rawBudgets, categories, allTransactions, month, year),
    [rawBudgets, categories, allTransactions, month, year]
  );

  const totalBudget = budgetsThisMonth.reduce((s, b) => s + b.amount, 0);
  const totalSpent = weeks.reduce((s, w) => s + w.total, 0);
  const remainingRaw = totalBudget - totalSpent;
  const isOverBudget = totalBudget > 0 && remainingRaw < 0;
  const remaining = Math.max(remainingRaw, 0);
  const perWeek = calcWeeklyAllowance(remaining, weeks.length);

  const chartData = weeks.map((w, i) => ({ label: w.label, total: w.total, index: i }));
  const activeWeek = selectedWeek !== null ? weeks[selectedWeek] : null;

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div ref={wrapperRef} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card sm:col-span-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {isOverBudget ? "Over Budget This Month" : "Remaining This Month"}
          </p>
          <p className={`text-lg font-bold mt-1 whitespace-nowrap ${
            isOverBudget ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
          }`}>
            {formatCurrency(isOverBudget ? Math.abs(remainingRaw) : remaining, currency)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {totalBudget > 0 ? `of ${formatCurrency(totalBudget, currency)} budgeted` : "No budget set yet"}
          </p>
        </div>
        <div className={`rounded-2xl p-5 text-white shadow-sm sm:col-span-2 flex items-center justify-between ${
          isOverBudget
            ? "bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-700 dark:to-rose-800"
            : "bg-gradient-to-br from-indigo-500 to-violet-600 dark:from-indigo-700 dark:to-violet-800"
        }`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Left Per Week</p>
            <p className="text-xl font-bold whitespace-nowrap">
              {isOverBudget ? "Nothing left" : formatCurrency(perWeek, currency)}
            </p>
            <p className="text-xs opacity-70 mt-1">
              {isOverBudget
                ? "You've spent past this month's total budget"
                : `Remaining ÷ ${weeks.length} weeks this month`}
            </p>
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Weekly Spend</p>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="btn-ghost px-2 py-0.5 text-xs">←</button>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-24 text-center">
              {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => shiftMonth(1)} className="btn-ghost px-2 py-0.5 text-xs">→</button>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Tap a week to see its category breakdown</p>

        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={44} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.15)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                      <p className="font-semibold text-gray-900 dark:text-white">{p.label}</p>
                      <p className="text-indigo-600 dark:text-indigo-400">{formatCurrency(p.total, currency)}</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(_, index) => setSelectedWeek((prev) => (prev === index ? null : index))}
              >
                {chartData.map((d) => (
                  <Cell key={d.index} fill={selectedWeek === d.index ? BAR_COLOR_ACTIVE : BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {activeWeek && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 animate-[fadeIn_150ms_ease-out]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                {activeWeek.label} · {formatCurrency(activeWeek.total, currency)}
              </p>
              <button onClick={() => setSelectedWeek(null)} className="btn-ghost text-xs px-1.5 py-0.5">✕ Close</button>
            </div>
            {activeWeek.breakdown.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No expenses this week</p>
            ) : (
              <div className="flex items-center gap-4">
                <div style={{ width: 140, height: 140 }} className="shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={activeWeek.breakdown} dataKey="total" nameKey="name" innerRadius={35} outerRadius={65}
                           paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {activeWeek.breakdown.map((d, i) => (
                          <Cell key={d.categoryId} fill={d.color || PIE_COLORS_FALLBACK[i % PIE_COLORS_FALLBACK.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload as (typeof activeWeek.breakdown)[number];
                          return (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                              <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                              <p className="text-gray-500 dark:text-gray-400">{formatCurrency(p.total, currency)} · {p.pct.toFixed(1)}%</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  {activeWeek.breakdown.map((d) => (
                    <div key={d.categoryId} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200 shrink-0 ml-2">
                        {formatCurrency(d.total, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
