"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import CategoryFormModal from "@/components/budget/CategoryFormModal";
import { getIcon } from "@/lib/budget/icons";
import { monthsAhead } from "@/lib/budget/calculations";
import { Plus } from "lucide-react";
import type { FinCategory, FinBudget } from "@/types/budget";

const FORWARD_FILL_MONTHS = 11; // + the selected month itself = 12 months covered

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
  const [localCategories, setLocalCategories] = useState(categories);
  useEffect(() => setLocalCategories(categories), [categories]);
  const [showNewCategory, setShowNewCategory] = useState(false);

  const expenseCategories = localCategories.filter((c) => c.kind === "EXPENSE" && !c.archived);
  const [categoryId, setCategoryId] = useState(budget?.category_id ?? "");
  const [amount, setAmount] = useState(budget?.amount ?? 0);
  const [recurring, setRecurring] = useState(budget?.recurring ?? false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableCategories = budget
    ? expenseCategories
    : expenseCategories.filter((c) => !existingBudgetCategoryIds.includes(c.id));

  function handleCategoryCreated(cat: FinCategory) {
    setLocalCategories((prev) => [...prev, cat]);
    setCategoryId(cat.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) { setError("Choose a category."); return; }
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }

    setLoading(true);
    const supabase = createClient();

    const { error: dbError } = budget
      ? await supabase.from("fin_budgets").update({ amount, recurring }).eq("id", budget.id)
      : await supabase.from("fin_budgets").upsert(
          { user_id: userId, category_id: categoryId, amount, month, year, recurring },
          { onConflict: "user_id,category_id,month,year" }
        );

    if (dbError) { setError(dbError.message); setLoading(false); return; }

    // Recurring: pre-create the same budget for the next 11 months so it
    // shows up automatically without needing a server-side cron job.
    if (recurring) {
      const targetCategoryId = budget?.category_id ?? categoryId;
      const rows = monthsAhead(month, year, FORWARD_FILL_MONTHS).map(({ month: m, year: y }) => ({
        user_id: userId, category_id: targetCategoryId, amount, month: m, year: y, recurring: true,
      }));
      await supabase.from("fin_budgets").upsert(rows, { onConflict: "user_id,category_id,month,year" });
    }

    setLoading(false);
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
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  <Plus size={16} />
                  <span>New</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Monthly Limit</label>
            <CurrencyInput value={amount} onChange={setAmount} className="input-field text-lg font-semibold" placeholder="0.00" />
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                     className="w-4 h-4 accent-amber-500" />
              Repeat this budget every month
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Automatically sets the same limit for this category for the next 12 months.
            </p>
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

      {showNewCategory && (
        <CategoryFormModal
          userId={userId}
          defaultKind="EXPENSE"
          lockKind
          onClose={() => setShowNewCategory(false)}
          onSaved={handleCategoryCreated}
        />
      )}
    </div>
  );
}
