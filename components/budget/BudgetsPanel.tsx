"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcBudgetPace, formatCurrency } from "@/lib/budget/calculations";
import { getIcon } from "@/lib/budget/icons";
import BudgetFormModal from "@/components/budget/BudgetFormModal";
import type { FinCategory, FinTransaction, BudgetWithSpend } from "@/types/budget";

interface Props {
  userId: string;
  budgets: BudgetWithSpend[];
  categories: FinCategory[];
  transactions: FinTransaction[];
  month: number;
  year: number;
  currency: string;
  onChanged: () => void;
  onMonthYearChange: (month: number, year: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  "on-track": "bg-emerald-500",
  warning: "bg-orange-500",
  over: "bg-red-500",
};

export default function BudgetsPanel({ userId, budgets, categories, month, year, currency, onChanged, onMonthYearChange }: Props) {
  const [editing, setEditing] = useState<BudgetWithSpend | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("fin_budgets").delete().eq("id", id);
    setDeletingId(null);
    onChanged();
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    onMonthYearChange(m, y);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="btn-ghost px-2 py-1">←</button>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
            </p>
            {totalBudget > 0 && (
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                {formatCurrency(totalSpent, currency)} of {formatCurrency(totalBudget, currency)} spent
              </p>
            )}
          </div>
          <button onClick={() => shiftMonth(1)} className="btn-ghost px-2 py-1">→</button>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-3 py-1.5">+ Budget</button>
      </div>

      {budgets.length === 0 ? (
        <div className="stat-card text-center py-10">
          <p className="text-sm text-gray-400">No budgets set for this month yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {budgets.map((b) => {
            const pace = calcBudgetPace(b.spent, b.amount, month, year);
            const Icon = getIcon(b.category.icon);
            const barWidth = Math.min(pace.pctSpent, 100);
            return (
              <div key={b.id} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: b.category.color }}>
                      <Icon size={14} />
                    </span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.category.name}</p>
                    {b.recurring && <span className="text-xs shrink-0" title="Repeats every month">🔁</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(b)} className="btn-ghost text-xs px-1.5 py-0.5">✏️</button>
                    <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-xs px-1">
                      {deletingId === b.id ? "…" : "🗑"}
                    </button>
                  </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-1.5 relative">
                  <div className={`h-2 rounded-full transition-all ${STATUS_COLOR[pace.status]}`} style={{ width: `${barWidth}%` }} />
                  {pace.pctElapsed < 100 && (
                    <div
                      className="absolute top-[-3px] w-0.5 h-3.5 bg-gray-500 dark:bg-gray-300"
                      style={{ left: `${Math.min(pace.pctElapsed, 100)}%` }}
                      title={`Day pace: ${pace.pctElapsed.toFixed(0)}%`}
                    />
                  )}
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatCurrency(b.spent, currency)} / {formatCurrency(b.amount, currency)}
                  </span>
                  <span className={`font-semibold ${
                    pace.status === "over" ? "text-red-600 dark:text-red-400"
                    : pace.status === "warning" ? "text-orange-600 dark:text-orange-400"
                    : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {pace.pctSpent.toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  {pace.aheadOfPace ? "Spending faster than your day-of-month pace" : "On pace for the month"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {(showAdd || editing) && (
        <BudgetFormModal
          userId={userId}
          categories={categories}
          existingBudgetCategoryIds={budgets.map((b) => b.category_id)}
          budget={editing ?? undefined}
          month={month}
          year={year}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
