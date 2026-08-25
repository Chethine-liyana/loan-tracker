"use client";

import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import {
  buildSpendTrend, buildCategoryBreakdown, buildMonthlyInflowOutflow,
  calcSafeToSpend, formatCurrency,
} from "@/lib/budget/calculations";
import { getIcon } from "@/lib/budget/icons";
import SummaryCardExport from "@/components/budget/SummaryCardExport";
import type { FinTransaction, FinCategory, FinAccount, DateRange, FinBudget } from "@/types/budget";

interface Props {
  transactions: FinTransaction[];
  allTransactions: FinTransaction[]; // unfiltered, for the 6-month inflow/outflow chart
  categories: FinCategory[];
  accounts: FinAccount[];
  budgets: FinBudget[];
  range: DateRange;
  currency: string;
}

const PIE_COLORS_FALLBACK = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export default function OverviewPanel({
  transactions, allTransactions, categories, accounts, budgets, range, currency,
}: Props) {
  const trend = buildSpendTrend(transactions, range);
  const breakdown = buildCategoryBreakdown(transactions, categories, "EXPENSE");
  const inflowOutflow = buildMonthlyInflowOutflow(allTransactions, 6);

  const income = transactions.filter((t) => t.kind === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.kind === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const safeToSpend = calcSafeToSpend(totalBudget, expense);

  const recent = [...allTransactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created_at.localeCompare(a.created_at)))
    .slice(0, 8);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <SummaryCardExport
          periodLabel={`${format(new Date(range.from), "MMM d")} – ${format(new Date(range.to), "MMM d")}`}
          income={income}
          expense={expense}
          currency={currency}
          topCategory={breakdown[0] ? { name: breakdown[0].name, total: breakdown[0].total } : undefined}
        />
      </div>

      {/* ── Top row: income/expense/net + safe-to-spend ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Income</p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 whitespace-nowrap">{formatCurrency(income, currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Expense</p>
          <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mt-1 whitespace-nowrap">{formatCurrency(expense, currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net</p>
          <p className={`text-base sm:text-lg font-bold mt-1 whitespace-nowrap ${income - expense >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(income - expense, currency)}
          </p>
        </div>
        {totalBudget > 0 ? (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-700 dark:to-teal-800 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Safe to Spend / Day</p>
            <p className="text-base sm:text-lg font-bold whitespace-nowrap">{formatCurrency(safeToSpend.perDay, currency)}</p>
            <p className="text-xs opacity-70 mt-1">{safeToSpend.daysLeft} days left this month</p>
          </div>
        ) : (
          <div className="stat-card justify-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">Set a budget to see your safe-to-spend rate.</p>
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Spend Trend (cumulative)
          </p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400"
                       interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={44} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-900 dark:text-white">{p.label}</p>
                        <p className="text-orange-600 dark:text-orange-400">Today: {formatCurrency(p.dayAmount, currency)}</p>
                        <p className="text-gray-500 dark:text-gray-400">Cumulative: {formatCurrency(p.cumulative, currency)}</p>
                        <p className="text-gray-400 dark:text-gray-500">Prev. period: {formatCurrency(p.previousCumulative, currency)}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="previousCumulative" stroke="#94a3b8" strokeDasharray="4 3" fill="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="cumulative" stroke="#f97316" fill="url(#spendFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Category Breakdown
          </p>
          {breakdown.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No expenses in this range</div>
          ) : (
            <>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={breakdown} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80}
                         paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {breakdown.map((d, i) => (
                        <Cell key={d.categoryId} fill={d.color || PIE_COLORS_FALLBACK[i % PIE_COLORS_FALLBACK.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as typeof breakdown[number];
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
              <div className="space-y-1 max-h-24 overflow-y-auto mt-1">
                {breakdown.slice(0, 6).map((d) => (
                  <div key={d.categoryId} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{d.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="stat-card lg:col-span-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Inflow vs Outflow (last 6 months)
          </p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={inflowOutflow} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-500 dark:text-gray-400" width={44} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                        {payload.map((p) => (
                          <p key={p.dataKey as string} style={{ color: p.color }}>
                            {p.dataKey === "income" ? "Income" : "Expense"}: {formatCurrency(Number(p.value), currency)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Recent transactions ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Recent Transactions</p>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {recent.length === 0 && <p className="text-sm text-gray-400 py-2">No transactions yet.</p>}
          {recent.map((t) => {
            const cat = t.category_id ? categoryMap.get(t.category_id) : null;
            const Icon = getIcon(cat?.icon ?? "shapes");
            const account = accountMap.get(t.account_id);
            const sign = t.kind === "INCOME" ? "+" : t.kind === "EXPENSE" ? "−" : "";
            const color = t.kind === "INCOME" ? "text-emerald-600 dark:text-emerald-400"
                        : t.kind === "EXPENSE" ? "text-red-600 dark:text-red-400"
                        : "text-blue-600 dark:text-blue-400";
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
                        style={{ backgroundColor: cat?.color ?? "#64748b" }}>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {t.note || cat?.name || t.kind}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {format(new Date(t.date), "dd MMM")} · {account?.name}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ${color}`}>{sign}{formatCurrency(t.amount, currency)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
