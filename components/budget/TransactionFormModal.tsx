"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { getIcon } from "@/lib/budget/icons";
import type { FinAccount, FinCategory, FinTransaction, TransactionKind, RecurrenceFrequency } from "@/types/budget";

interface Props {
  userId: string;
  accounts: FinAccount[];
  categories: FinCategory[];
  transaction?: FinTransaction;
  defaultAccountId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const KINDS: { value: TransactionKind; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

const FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionFormModal({
  userId, accounts, categories, transaction, defaultAccountId, onClose, onSaved,
}: Props) {
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? "EXPENSE");
  const [amount, setAmount] = useState(transaction?.amount ?? 0);
  const [accountId, setAccountId] = useState(
    transaction?.account_id ?? defaultAccountId ?? accounts[0]?.id ?? ""
  );
  const [toAccountId, setToAccountId] = useState(transaction?.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [date, setDate] = useState(transaction?.date ?? today());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === kind && !c.archived),
    [categories, kind]
  );

  function handleKindChange(k: TransactionKind) {
    setKind(k);
    setCategoryId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    if (!accountId) { setError("Choose an account."); return; }
    if (kind === "TRANSFER" && (!toAccountId || toAccountId === accountId)) {
      setError("Choose a different destination account."); return;
    }
    if (kind !== "TRANSFER" && !categoryId) { setError("Choose a category."); return; }

    setLoading(true);
    const supabase = createClient();

    const payload = {
      account_id: accountId,
      to_account_id: kind === "TRANSFER" ? toAccountId : null,
      category_id: kind === "TRANSFER" ? null : categoryId,
      kind,
      amount,
      date,
      note: note.trim() || null,
    };

    const { error: dbError } = transaction
      ? await supabase.from("fin_transactions").update(payload).eq("id", transaction.id)
      : await supabase.from("fin_transactions").insert({ ...payload, user_id: userId });

    if (dbError) { setError(dbError.message); setLoading(false); return; }

    if (!transaction && isRecurring && kind !== "TRANSFER") {
      await supabase.from("fin_recurring").insert({
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        kind,
        amount,
        note: note.trim() || null,
        frequency,
        next_run_date: date,
        active: true,
      });
    }

    setLoading(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-md w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          {transaction ? "Edit Transaction" : "New Transaction"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => handleKindChange(k.value)}
                className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  kind === k.value
                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Amount</label>
            <CurrencyInput value={amount} onChange={setAmount} className="input-field text-lg font-semibold" placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {kind === "TRANSFER" ? "From Account" : "Account"}
              </label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {kind === "TRANSFER" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">To Account</label>
                <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="input-field">
                  <option value="">Select…</option>
                  {accounts.filter((a) => a.id !== accountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
              </div>
            )}
          </div>

          {kind === "TRANSFER" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
          )}

          {kind !== "TRANSFER" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1">
                {filteredCategories.map((c) => {
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
                {filteredCategories.length === 0 && (
                  <p className="col-span-4 text-xs text-gray-400 py-2">
                    No {kind.toLowerCase()} categories yet — add one in Settings.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Note / Merchant <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="e.g. Keells" maxLength={280} />
          </div>

          {!transaction && kind !== "TRANSFER" && (
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
                       className="w-4 h-4 accent-amber-500" />
                Make this recurring
              </label>
              {isRecurring && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                        frequency === f
                          ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {f[0] + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
