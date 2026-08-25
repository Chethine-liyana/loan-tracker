"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import type { FinAccount, FinCategory, FinRecurring, RecurrenceFrequency } from "@/types/budget";

interface Props {
  userId: string;
  accounts: FinAccount[];
  categories: FinCategory[];
  recurring?: FinRecurring;
  onClose: () => void;
  onSaved: () => void;
}

const FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const today = () => new Date().toISOString().slice(0, 10);

export default function RecurringFormModal({ userId, accounts, categories, recurring, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">(recurring?.kind ?? "EXPENSE");
  const [amount, setAmount] = useState(recurring?.amount ?? 0);
  const [accountId, setAccountId] = useState(recurring?.account_id ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(recurring?.category_id ?? "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(recurring?.frequency ?? "MONTHLY");
  const [nextRunDate, setNextRunDate] = useState(recurring?.next_run_date ?? today());
  const [endDate, setEndDate] = useState(recurring?.end_date ?? "");
  const [note, setNote] = useState(recurring?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === kind && !c.archived),
    [categories, kind]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    if (!accountId) { setError("Choose an account."); return; }
    if (!categoryId) { setError("Choose a category."); return; }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      account_id: accountId, category_id: categoryId, kind, amount,
      note: note.trim() || null, frequency, next_run_date: nextRunDate,
      end_date: endDate || null,
    };

    const { error: dbError } = recurring
      ? await supabase.from("fin_recurring").update(payload).eq("id", recurring.id)
      : await supabase.from("fin_recurring").insert({ ...payload, user_id: userId, active: true });

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          {recurring ? "Edit Recurring" : "New Recurring Transaction"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setKind(k); setCategoryId(""); }}
                className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  kind === k ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                             : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                }`}>
                {k === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Amount</label>
            <CurrencyInput value={amount} onChange={setAmount} className="input-field text-lg font-semibold" placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-field">
                <option value="">Select…</option>
                {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Frequency</label>
            <div className="grid grid-cols-4 gap-1.5">
              {FREQUENCIES.map((f) => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                    frequency === f ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                  }`}>
                  {f[0] + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Next Run</label>
              <input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                End Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="e.g. Netflix" maxLength={280} />
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
