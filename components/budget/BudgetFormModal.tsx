"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { getIcon } from "@/lib/budget/icons";
import type { FinCategory, FinBudget } from "@/types/budget";

interface Props {
  userId: string;
  categories: FinCategory[];
  existingBudgetCategoryIds: string[];
  budget?: FinBudget;
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function BudgetFormModal({
  userId, categories, existingBudgetCategoryIds, budget, month, year, onClose, onSaved,
}: Props) {
  const expenseCategories = categories.filter((c) => c.kind === "EXPENSE" && !c.archived);
  const [categoryId, setCategoryId] = useState(budget?.category_id ?? "");
  const [amount, setAmount] = useState(budget?.amount ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableCategories = budget
    ? expenseCategories
    : expenseCategories.filter((c) => !existingBudgetCategoryIds.includes(c.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) { setError("Choose a category."); return; }
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }

    setLoading(true);
    const supabase = createClient();

    const { error: dbError } = budget
      ? await supabase.from("fin_budgets").update({ amount }).eq("id", budget.id)
      : await supabase.from("fin_budgets").upsert(
          { user_id: userId, category_id: categoryId, amount, month, year },
          { onConflict: "user_id,category_id,month,year" }
        );

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
          {budget ? "Edit Budget" : "New Budget"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!budget && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1">
                {availableCategories.map((c) => {
                  const Icon = getIcon(c.icon);
                  const active = categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 text-[11px] font-medium transition-colors ${
                        active ? "border-transparent text-white" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      }`}
                      style={active ? { backgroundColor: c.color } : undefined}
                    >
                      <Icon size={16} />
                      <span className="truncate w-full text-center px-0.5">{c.name}</span>
                    </button>
                  );
                })}
                {availableCategories.length === 0 && (
                  <p className="col-span-4 text-xs text-gray-400 py-2">
                    Every expense category already has a budget this period.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Monthly Limit</label>
            <CurrencyInput value={amount} onChange={setAmount} className="input-field text-lg font-semibold" placeholder="0.00" />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
