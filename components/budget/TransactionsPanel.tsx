"use client";

import { useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, toCSV, downloadFile, sortCategoriesHierarchically } from "@/lib/budget/calculations";
import { getIcon } from "@/lib/budget/icons";
import TransactionFormModal from "@/components/budget/TransactionFormModal";
import type { FinTransaction, FinCategory, FinAccount } from "@/types/budget";

interface Props {
  userId: string;
  transactions: FinTransaction[];
  accounts: FinAccount[];
  categories: FinCategory[];
  currency: string;
  onChanged: () => void;
}

export default function TransactionsPanel({ userId, transactions, accounts, categories, currency, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "EXPENSE" | "INCOME" | "TRANSFER">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [editing, setEditing] = useState<FinTransaction | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => kindFilter === "ALL" || t.kind === kindFilter)
      .filter((t) => categoryFilter === "ALL" || t.category_id === categoryFilter)
      .filter((t) => !search || (t.note ?? "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created_at.localeCompare(a.created_at)));
  }, [transactions, kindFilter, categoryFilter, search]);

  // Group consecutive same-date rows under one divider, with that day's net total
  // (income − expense; transfers don't affect net so they're excluded).
  const groups = useMemo(() => {
    const out: { date: string; net: number; items: FinTransaction[] }[] = [];
    for (const t of filtered) {
      let group = out[out.length - 1];
      if (!group || group.date !== t.date) {
        group = { date: t.date, net: 0, items: [] };
        out.push(group);
      }
      group.items.push(t);
      if (t.kind === "INCOME") group.net += t.amount;
      else if (t.kind === "EXPENSE") group.net -= t.amount;
    }
    return out;
  }, [filtered]);

  function dateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "EEEE, dd MMM yyyy");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("fin_transactions").delete().eq("id", id);
    setDeletingId(null);
    onChanged();
  }

  function exportCSV() {
    const csv = toCSV(filtered, {
      accountName: (id) => accountMap.get(id)?.name ?? "",
      categoryName: (id) => (id ? categoryMap.get(id)?.name ?? "" : ""),
    });
    downloadFile(csv, `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  }

  function exportJSON() {
    downloadFile(JSON.stringify(filtered, null, 2), `transactions-${format(new Date(), "yyyy-MM-dd")}.json`, "application/json");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="input-field py-1.5 text-sm flex-1 min-w-[140px]"
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="input-field py-1.5 text-sm w-auto">
          <option value="ALL">All types</option>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field py-1.5 text-sm w-auto">
          <option value="ALL">All categories</option>
          {sortCategoriesHierarchically(categories).map((c) => (
            <option key={c.id} value={c.id}>{c.parent_id ? `↳ ${c.name}` : c.name}</option>
          ))}
        </select>
        <button onClick={exportCSV} className="btn-secondary text-xs px-2.5 py-1.5">CSV</button>
        <button onClick={exportJSON} className="btn-secondary text-xs px-2.5 py-1.5">JSON</button>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm px-3 py-1.5 ml-auto">+ Add</button>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filtered.length === 0 && <p className="text-sm text-gray-400 p-6 text-center">No transactions match.</p>}
          {groups.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/40">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{dateLabel(group.date)}</span>
                <span className={`text-xs font-bold ${
                  group.net > 0 ? "text-emerald-600 dark:text-emerald-400"
                  : group.net < 0 ? "text-red-600 dark:text-red-400"
                  : "text-gray-400 dark:text-gray-500"
                }`}>
                  {group.net > 0 ? "+" : group.net < 0 ? "−" : ""}{formatCurrency(Math.abs(group.net), currency)}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.items.map((t) => {
                  const cat = t.category_id ? categoryMap.get(t.category_id) : null;
                  const Icon = getIcon(cat?.icon ?? (t.kind === "TRANSFER" ? "repeat" : "shapes"));
                  const account = accountMap.get(t.account_id);
                  const toAccount = t.to_account_id ? accountMap.get(t.to_account_id) : null;
                  const sign = t.kind === "INCOME" ? "+" : t.kind === "EXPENSE" ? "−" : "";
                  const color = t.kind === "INCOME" ? "text-emerald-600 dark:text-emerald-400"
                              : t.kind === "EXPENSE" ? "text-red-600 dark:text-red-400"
                              : "text-blue-600 dark:text-blue-400";
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <button onClick={() => setEditing(t)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white"
                              style={{ backgroundColor: cat?.color ?? "#64748b" }}>
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {t.note || cat?.name || (t.kind === "TRANSFER" ? "Transfer" : t.kind)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {account?.name}
                            {toAccount ? ` → ${toAccount.name}` : ""}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold ${color}`}>{sign}{formatCurrency(t.amount, currency)}</span>
                        <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                                className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-sm px-1">
                          {deletingId === t.id ? "…" : "🗑"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(showAdd || editing) && (
        <TransactionFormModal
          userId={userId}
          accounts={accounts}
          categories={categories}
          transaction={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
