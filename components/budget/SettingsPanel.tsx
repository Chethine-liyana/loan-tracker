"use client";

import { useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { CURRENCY_CODES, nextOccurrence, toCSV, downloadFile } from "@/lib/budget/calculations";
import { getIcon } from "@/lib/budget/icons";
import CategoryFormModal from "@/components/budget/CategoryFormModal";
import RecurringFormModal from "@/components/budget/RecurringFormModal";
import ImportCsvModal from "@/components/budget/ImportCsvModal";
import type { FinCategory, FinRecurring, FinAccount, FinTransaction } from "@/types/budget";

interface Props {
  userId: string;
  currency: string;
  categories: FinCategory[];
  recurring: FinRecurring[];
  accounts: FinAccount[];
  allTransactions: FinTransaction[];
  onChanged: () => void;
}

const MAX_OCCURRENCES_PER_RUN = 24;

export default function SettingsPanel({ userId, currency, categories, recurring, accounts, allTransactions, onChanged }: Props) {
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinCategory | null>(null);
  const [addingCategory, setAddingCategory] = useState<"EXPENSE" | "INCOME" | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<FinRecurring | null>(null);
  const [addingRecurring, setAddingRecurring] = useState(false);
  const [runningRecurring, setRunningRecurring] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const expenseCats = categories.filter((c) => c.kind === "EXPENSE");
  const incomeCats = categories.filter((c) => c.kind === "INCOME");
  const dueCount = recurring.filter((r) => r.active && r.next_run_date <= format(new Date(), "yyyy-MM-dd")).length;

  async function handleCurrencyChange(next: string) {
    setSavingCurrency(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("fin_profiles").upsert({ user_id: user.id, base_currency: next }, { onConflict: "user_id" });
    }
    setSavingCurrency(false);
    onChanged();
  }

  async function toggleCategoryArchive(c: FinCategory) {
    const supabase = createClient();
    await supabase.from("fin_categories").update({ archived: !c.archived }).eq("id", c.id);
    onChanged();
  }

  async function deleteRecurring(id: string) {
    if (!confirm("Delete this recurring transaction?")) return;
    const supabase = createClient();
    await supabase.from("fin_recurring").delete().eq("id", id);
    onChanged();
  }

  /** Materializes all due recurring transactions into real transactions (client-side, mirrors the server cron logic). */
  async function runDueRecurring() {
    setRunningRecurring(true);
    const supabase = createClient();
    const now = format(new Date(), "yyyy-MM-dd");
    const due = recurring.filter((r) => r.active && r.next_run_date <= now);

    for (const r of due) {
      let nextRunDate = new Date(r.next_run_date);
      let occurrences = 0;
      const rows: { date: string }[] = [];
      const end = r.end_date ? new Date(r.end_date) : null;
      const nowDate = new Date(now);

      while (nextRunDate <= nowDate && occurrences < MAX_OCCURRENCES_PER_RUN && (!end || nextRunDate <= end)) {
        rows.push({ date: format(nextRunDate, "yyyy-MM-dd") });
        nextRunDate = nextOccurrence(nextRunDate, r.frequency);
        occurrences++;
      }
      if (rows.length === 0) continue;

      const stillActive = !end || nextRunDate <= end;

      await supabase.from("fin_transactions").insert(
        rows.map((row) => ({
          user_id: userId,
          account_id: r.account_id,
          category_id: r.category_id,
          kind: r.kind,
          amount: r.amount,
          date: row.date,
          note: r.note,
        }))
      );
      await supabase.from("fin_recurring").update({
        next_run_date: format(nextRunDate, "yyyy-MM-dd"),
        active: stillActive,
      }).eq("id", r.id);
    }

    setRunningRecurring(false);
    onChanged();
  }

  function exportAll() {
    const csv = toCSV(allTransactions, {
      accountName: (id) => accountMap.get(id)?.name ?? "",
      categoryName: (id) => (id ? categoryMap.get(id)?.name ?? "" : ""),
    });
    downloadFile(csv, `all-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  }

  return (
    <div className="space-y-5">
      {/* ── Currency ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Currency</p>
        <select value={currency} disabled={savingCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} className="input-field w-auto">
          {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Categories ── */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Categories</p>
        </div>
        {(["EXPENSE", "INCOME"] as const).map((kind) => (
          <div key={kind} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400">{kind === "EXPENSE" ? "Expense" : "Income"}</p>
              <button onClick={() => setAddingCategory(kind)} className="btn-ghost text-xs">+ Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(kind === "EXPENSE" ? expenseCats : incomeCats).map((c) => {
                const Icon = getIcon(c.icon);
                return (
                  <button
                    key={c.id}
                    onClick={() => setEditingCategory(c)}
                    className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium transition-opacity ${
                      c.archived ? "opacity-40 border-gray-200 dark:border-gray-700" : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: c.color }}>
                      <Icon size={11} />
                    </span>
                    <span className="text-gray-700 dark:text-gray-200">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Recurring transactions ── */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Recurring</p>
          <div className="flex items-center gap-2">
            {dueCount > 0 && (
              <button onClick={runDueRecurring} disabled={runningRecurring} className="btn-secondary text-xs px-2.5 py-1">
                {runningRecurring ? "Running…" : `Run ${dueCount} due`}
              </button>
            )}
            <button onClick={() => setAddingRecurring(true)} className="btn-ghost text-xs">+ Add</button>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {recurring.length === 0 && <p className="text-sm text-gray-400 py-2">No recurring transactions.</p>}
          {recurring.map((r) => {
            const cat = r.category_id ? categoryMap.get(r.category_id) : null;
            const account = accountMap.get(r.account_id);
            const isDue = r.active && r.next_run_date <= format(new Date(), "yyyy-MM-dd");
            return (
              <div key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                <button onClick={() => setEditingRecurring(r)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {r.note || cat?.name || r.kind} <span className="text-gray-400 font-normal">· {r.frequency.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {account?.name} · next {format(new Date(r.next_run_date), "dd MMM yyyy")}
                    {isDue && <span className="text-amber-600 dark:text-amber-400 font-semibold"> · due</span>}
                    {!r.active && <span> · paused</span>}
                  </p>
                </button>
                <button onClick={() => deleteRecurring(r.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-sm px-1">🗑</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Import / Export ── */}
      <div className="stat-card">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Backup</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">Import transactions (CSV)</button>
          <button onClick={exportAll} className="btn-secondary text-sm">Export all transactions (CSV)</button>
        </div>
      </div>

      {(addingCategory || editingCategory) && (
        <CategoryFormModal
          userId={userId}
          category={editingCategory ?? undefined}
          defaultKind={addingCategory ?? "EXPENSE"}
          onClose={() => { setAddingCategory(null); setEditingCategory(null); }}
          onSaved={onChanged}
          onArchiveToggle={editingCategory ? () => toggleCategoryArchive(editingCategory) : undefined}
        />
      )}
      {(addingRecurring || editingRecurring) && (
        <RecurringFormModal
          userId={userId}
          accounts={accounts}
          categories={categories}
          recurring={editingRecurring ?? undefined}
          onClose={() => { setAddingRecurring(false); setEditingRecurring(null); }}
          onSaved={onChanged}
        />
      )}
      {showImport && (
        <ImportCsvModal
          userId={userId}
          accounts={accounts}
          categories={categories}
          allTransactions={allTransactions}
          onClose={() => setShowImport(false)}
          onImported={onChanged}
        />
      )}
    </div>
  );
}
