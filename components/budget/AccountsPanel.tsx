"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/budget/calculations";
import { getIcon } from "@/lib/budget/icons";
import AccountFormModal from "@/components/budget/AccountFormModal";
import type { AccountWithBalance } from "@/types/budget";

interface Props {
  userId: string;
  accounts: AccountWithBalance[];
  currency: string;
  onChanged: () => void;
}

export default function AccountsPanel({ userId, accounts, currency, onChanged }: Props) {
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);

  async function handleDelete(a: AccountWithBalance) {
    if (!confirm(`Remove "${a.name}"? If it has transactions it will be archived instead of deleted.`)) return;
    setBusyId(a.id);
    const supabase = createClient();
    const { count } = await supabase
      .from("fin_transactions")
      .select("id", { count: "exact", head: true })
      .or(`account_id.eq.${a.id},to_account_id.eq.${a.id}`);

    if (!count) {
      await supabase.from("fin_accounts").delete().eq("id", a.id);
    } else {
      await supabase.from("fin_accounts").update({ archived: true }).eq("id", a.id);
    }
    setBusyId(null);
    onChanged();
  }

  async function handleUnarchive(a: AccountWithBalance) {
    setBusyId(a.id);
    const supabase = createClient();
    await supabase.from("fin_accounts").update({ archived: false }).eq("id", a.id);
    setBusyId(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalBalance, currency)}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-3 py-1.5">+ Account</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {active.map((a) => {
          const Icon = getIcon(a.icon);
          return (
            <div key={a.id} className="stat-card flex-row items-center justify-between">
              <button onClick={() => setEditing(a)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: a.color }}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{a.type} · {a.currency}</p>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-bold ${a.balance < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                  {formatCurrency(a.balance, a.currency)}
                </span>
                <button onClick={() => handleDelete(a)} disabled={busyId === a.id}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-sm px-1">
                  {busyId === a.id ? "…" : "🗑"}
                </button>
              </div>
            </div>
          );
        })}
        {active.length === 0 && (
          <div className="stat-card sm:col-span-2 text-center py-10">
            <p className="text-sm text-gray-400">No accounts yet — add one to start tracking.</p>
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <details className="stat-card">
          <summary className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 space-y-2">
            {archived.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{a.name}</span>
                <button onClick={() => handleUnarchive(a)} disabled={busyId === a.id} className="btn-ghost text-xs">
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {(showAdd || editing) && (
        <AccountFormModal
          userId={userId}
          account={editing ?? undefined}
          defaultCurrency={currency}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
