"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BankContact } from "@/types";

interface Props {
  userId: string;
  contact?: BankContact;
  bankSuggestions: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BankContactFormModal({ userId, contact, bankSuggestions, onClose, onSaved }: Props) {
  const [nickname, setNickname] = useState(contact?.nickname ?? "");
  const [name, setName] = useState(contact?.name ?? "");
  const [bank, setBank] = useState(contact?.bank ?? "");
  const [branch, setBranch] = useState(contact?.branch ?? "");
  const [accountNo, setAccountNo] = useState(contact?.account_no ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!bank.trim()) { setError("Bank is required."); return; }
    if (!accountNo.trim()) { setError("Account No is required."); return; }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      nickname: nickname.trim() || null,
      name: name.trim(),
      bank: bank.trim(),
      branch: branch.trim() || null,
      account_no: accountNo.trim(),
    };

    const { error: dbError } = contact
      ? await supabase.from("bank_contacts").update(payload).eq("id", contact.id)
      : await supabase.from("bank_contacts").insert({ ...payload, user_id: userId });

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-sm w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          {contact ? "Edit Bank Details" : "New Bank Details"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nickname</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input-field" placeholder="e.g. Me, Kasun" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name (as on the account)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. K. A. Perera" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bank</label>
            <input value={bank} onChange={(e) => setBank(e.target.value)} className="input-field" list="bank-suggestions" placeholder="e.g. Commercial Bank" />
            <datalist id="bank-suggestions">
              {bankSuggestions.map((b) => <option key={b} value={b} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} className="input-field" placeholder="e.g. Kandy" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Account No</label>
            <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="input-field font-mono" autoComplete="off" placeholder="e.g. 8001234567" />
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
