"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import IconColorPicker from "@/components/budget/IconColorPicker";
import { CURRENCY_CODES } from "@/lib/budget/calculations";
import { ACCOUNT_TYPE_ICON } from "@/lib/budget/icons";
import type { FinAccount, AccountType } from "@/types/budget";

interface Props {
  userId: string;
  account?: FinAccount;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: () => void;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

export default function AccountFormModal({ userId, account, defaultCurrency, onClose, onSaved }: Props) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "cash");
  const [startingBalance, setStartingBalance] = useState(account?.starting_balance ?? 0);
  const [currency, setCurrency] = useState(account?.currency ?? defaultCurrency);
  const [icon, setIcon] = useState(account?.icon ?? ACCOUNT_TYPE_ICON.cash);
  const [color, setColor] = useState(account?.color ?? "#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleTypeChange(t: AccountType) {
    setType(t);
    if (!account) setIcon(ACCOUNT_TYPE_ICON[t]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      name: name.trim(), type, icon, color,
      starting_balance: startingBalance, currency,
    };

    const { error: dbError } = account
      ? await supabase.from("fin_accounts").update(payload).eq("id", account.id)
      : await supabase.from("fin_accounts").insert({ ...payload, user_id: userId });

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          {account ? "Edit Account" : "New Account"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Cash Wallet" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                    type === t.value
                      ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {account ? "Starting Balance" : "Opening Balance"}
              </label>
              <CurrencyInput value={startingBalance} onChange={setStartingBalance} className="input-field" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <IconColorPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />

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
