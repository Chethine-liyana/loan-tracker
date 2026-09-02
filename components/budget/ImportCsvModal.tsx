"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  parseDimeExport, planNewCategories, dedupeAgainstExisting,
  type ImportedRow, type CategoryPlanEntry,
} from "@/lib/budget/csvImport";
import { getIcon } from "@/lib/budget/icons";
import type { FinAccount, FinCategory, FinTransaction } from "@/types/budget";

interface Props {
  userId: string;
  accounts: FinAccount[];
  categories: FinCategory[];
  allTransactions: FinTransaction[];
  onClose: () => void;
  onImported: () => void;
}

type Stage = "pick" | "preview" | "importing" | "done";

export default function ImportCsvModal({ userId, accounts, categories, allTransactions, onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [newCategories, setNewCategories] = useState<CategoryPlanEntry[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; categoriesCreated: number; skipped: number } | null>(null);

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows: parsed, errors } = parseDimeExport(text);
      if (parsed.length === 0) {
        setError("Couldn't find any valid rows. Expected columns: Date, Note, Amount, Category, Type.");
        return;
      }
      const { toImport, skipped } = dedupeAgainstExisting(parsed, allTransactions);
      setRows(toImport);
      setDuplicates(skipped);
      setParseErrors(errors);
      setNewCategories(planNewCategories(toImport, categories));
      setStage("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!accountId) { setError("Choose an account for these transactions."); return; }
    setError(null);
    setStage("importing");

    const supabase = createClient();

    // 1. Create any missing categories first.
    const categoryIdByKey = new Map<string, string>();
    for (const c of categories) categoryIdByKey.set(`${c.name.toLowerCase()}|${c.kind}`, c.id);

    if (newCategories.length > 0) {
      const { data: created, error: catErr } = await supabase
        .from("fin_categories")
        .insert(newCategories.map((c) => ({
          user_id: userId, name: c.name, kind: c.kind, icon: c.icon, color: c.color,
        })))
        .select("*");

      if (catErr) { setError(catErr.message); setStage("preview"); return; }
      created?.forEach((c) => categoryIdByKey.set(`${c.name.toLowerCase()}|${c.kind}`, c.id));
    }

    // Map each row's ORIGINAL category name to whatever id it resolved to
    // (which may be a "(Income)"/"(Expense)"-disambiguated category).
    const resolveCategoryId = (row: ImportedRow): string | null => {
      const disambiguated = newCategories.find(
        (c) => c.originalName.toLowerCase() === row.categoryName.toLowerCase() && c.kind === row.kind
      );
      const key = disambiguated
        ? `${disambiguated.name.toLowerCase()}|${row.kind}`
        : `${row.categoryName.toLowerCase()}|${row.kind}`;
      return categoryIdByKey.get(key) ?? null;
    };

    // 2. Insert transactions in chunks.
    const payloads = rows.map((r) => ({
      user_id: userId,
      account_id: accountId,
      to_account_id: null,
      category_id: resolveCategoryId(r),
      kind: r.kind,
      amount: r.amount,
      date: r.date,
      note: r.note || null,
    }));

    const CHUNK = 200;
    setProgress({ done: 0, total: payloads.length });
    let imported = 0;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      const { error: txErr } = await supabase.from("fin_transactions").insert(chunk);
      if (txErr) { setError(txErr.message); setStage("preview"); return; }
      imported += chunk.length;
      setProgress({ done: imported, total: payloads.length });
    }

    setResult({ imported, categoriesCreated: newCategories.length, skipped: duplicates });
    setStage("done");
    onImported();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-lg w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Import Transactions</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Upload a CSV with Date, Note, Amount, Category, Type columns (e.g. exported from Dime).
        </p>

        {stage === "pick" && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 transition-colors"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Click to choose a .csv file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-sm space-y-1">
              <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{fileName}</p>
              <p className="text-gray-500 dark:text-gray-400">{rows.length} transaction{rows.length !== 1 ? "s" : ""} ready to import</p>
              {duplicates > 0 && (
                <p className="text-amber-600 dark:text-amber-400">{duplicates} duplicate{duplicates !== 1 ? "s" : ""} already in your account — skipped</p>
              )}
              {parseErrors.length > 0 && (
                <p className="text-red-500 dark:text-red-400">{parseErrors.length} row(s) couldn't be read and will be skipped</p>
              )}
            </div>

            {newCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {newCategories.length} new categor{newCategories.length !== 1 ? "ies" : "y"} will be created
                </p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {newCategories.map((c) => {
                    const Icon = getIcon(c.icon);
                    return (
                      <span key={`${c.name}-${c.kind}`} className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: c.color }}>
                          <Icon size={11} />
                        </span>
                        <span className="text-gray-700 dark:text-gray-200">{c.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Assign these transactions to account
              </label>
              {accounts.length === 0 ? (
                <p className="text-xs text-red-500">You need at least one account first — create one in the Accounts tab, then come back.</p>
              ) : (
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleImport} disabled={rows.length === 0 || accounts.length === 0} className="btn-primary flex-1">
                Import {rows.length} transaction{rows.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {stage === "importing" && (
          <div className="py-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Importing {progress.done} / {progress.total}…
            </p>
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold mb-1">Import complete 🎉</p>
              <p>{result.imported} transaction{result.imported !== 1 ? "s" : ""} imported</p>
              {result.categoriesCreated > 0 && <p>{result.categoriesCreated} new categor{result.categoriesCreated !== 1 ? "ies" : "y"} created</p>}
              {result.skipped > 0 && <p>{result.skipped} duplicate{result.skipped !== 1 ? "s" : ""} skipped</p>}
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
