"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BankContactFormModal from "@/components/banks/BankContactFormModal";
import type { BankContact } from "@/types";

const COMMON_BANKS = [
  "Bank of Ceylon", "People's Bank", "Commercial Bank", "Hatton National Bank", "Sampath Bank",
  "Seylan Bank", "NDB Bank", "DFCC Bank", "Nations Trust Bank", "Pan Asia Bank", "Union Bank",
  "Amana Bank", "Cargills Bank", "National Savings Bank", "HSBC", "Standard Chartered",
];

/** navigator.clipboard needs a secure context; fall back to execCommand for older mobile browsers. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export default function BanksPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<BankContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BankContact | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data, error } = await supabase
      .from("bank_contacts")
      .select("*")
      .order("nickname", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    setLoadError(error
      ? (error.message.includes("bank_contacts")
          ? "Run supabase/bank_contacts.sql in Supabase first (it creates the table for this tab), then reload."
          : error.message)
      : null);
    setContacts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const bankSuggestions = useMemo(
    () => Array.from(new Set([...contacts.map((c) => c.bank), ...COMMON_BANKS])).sort(),
    [contacts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.nickname, c.name, c.bank, c.branch, c.account_no].some((v) => v?.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  async function handleCopy(c: BankContact, field: "name" | "account_no") {
    const key = `${c.id}:${field}`;
    if (await copyText(c[field])) {
      setCopiedId(key);
      setTimeout(() => setCopiedId((id) => (id === key ? null : id)), 1500);
    }
  }

  async function handleDelete(c: BankContact) {
    if (!confirm(`Delete bank details for "${c.nickname || c.name}"?`)) return;
    setBusyId(c.id);
    const supabase = createClient();
    await supabase.from("bank_contacts").delete().eq("id", c.id);
    setBusyId(null);
    fetchAll();
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-16">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bank Details</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Tap Name or Account No to copy it.</p>
        </div>
        <button onClick={() => setShowAdd(true)} disabled={!!loadError} className="btn-primary text-sm px-3 py-1.5 shrink-0">+ Add</button>
      </div>

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          {loadError}
        </div>
      )}

      {contacts.length > 3 && (
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field" placeholder="Search name, bank, branch…" />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((c) => (
          <div key={c.id} className="stat-card gap-3">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.nickname || c.name}</p>
                {c.nickname && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.name}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{c.bank}{c.branch ? ` · ${c.branch}` : ""}</p>
                <p className="text-base font-mono font-semibold text-gray-900 dark:text-white mt-1 break-all">{c.account_no}</p>
              </button>
              <div className="flex items-center shrink-0">
                <button onClick={() => setEditing(c)} className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 text-sm px-1" aria-label="Edit">✏️</button>
                <button onClick={() => handleDelete(c)} disabled={busyId === c.id} aria-label="Delete"
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-sm px-1">
                  {busyId === c.id ? "…" : "🗑"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([["name", "Name"], ["account_no", "Account No"]] as const).map(([field, label]) => {
                const copied = copiedId === `${c.id}:${field}`;
                return (
                  <button key={field} onClick={() => handleCopy(c, field)}
                          className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                            copied
                              ? "bg-green-500 text-white"
                              : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                          }`}>
                    {copied ? "✓ Copied" : `📋 ${label}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!loadError && contacts.length === 0 && (
          <div className="stat-card sm:col-span-2 text-center py-10">
            <p className="text-sm text-gray-400">No bank details yet. Add yours or a friend&apos;s.</p>
          </div>
        )}
        {contacts.length > 0 && filtered.length === 0 && (
          <div className="stat-card sm:col-span-2 text-center py-10">
            <p className="text-sm text-gray-400">No matches for &ldquo;{search}&rdquo;.</p>
          </div>
        )}
      </div>

      {userId && (showAdd || editing) && (
        <BankContactFormModal
          userId={userId}
          contact={editing ?? undefined}
          bankSuggestions={bankSuggestions}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
