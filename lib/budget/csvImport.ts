import type { CategoryKind, FinCategory, FinTransaction } from "@/types/budget";

/** RFC4180-ish CSV parser: handles quoted fields, embedded commas, and "" escaped quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export interface ImportedRow {
  date: string;       // YYYY-MM-DD
  note: string;
  amount: number;
  categoryName: string;
  kind: "EXPENSE" | "INCOME";
}

export interface ParseResult {
  rows: ImportedRow[];
  errors: string[]; // 1-indexed data-row numbers that couldn't be parsed
}

/**
 * Parses a "Date,Note,Amount,Category,Type" export (the format the Dime iOS
 * app produces) into rows ready to insert as fin_transactions.
 */
export function parseDimeExport(text: string): ParseResult {
  const table = parseCSV(text.trim());
  if (table.length === 0) return { rows: [], errors: [] };

  const [header, ...dataRows] = table;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const dateIdx = col("date");
  const noteIdx = col("note");
  const amountIdx = col("amount");
  const categoryIdx = col("category");
  const typeIdx = col("type");

  const rows: ImportedRow[] = [];
  const errors: string[] = [];

  dataRows.forEach((r, i) => {
    const rawDate = r[dateIdx]?.trim();
    const rawAmount = r[amountIdx]?.trim();
    const rawType = r[typeIdx]?.trim().toUpperCase();
    const categoryName = r[categoryIdx]?.trim();

    const date = rawDate?.slice(0, 10);
    const amount = Number(rawAmount);
    const kind = rawType === "EXPENSE" || rawType === "INCOME" ? rawType : null;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0 || !kind || !categoryName) {
      errors.push(`Row ${i + 2}`);
      return;
    }

    rows.push({ date, note: r[noteIdx]?.trim() ?? "", amount, categoryName, kind });
  });

  return { rows, errors };
}

export interface CategoryPlanEntry {
  name: string;        // possibly disambiguated, e.g. "Car (Income)"
  originalName: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

const KEYWORD_ICONS: Record<string, string> = {
  fuel: "fuel", car: "car", cab: "bus", transport: "bus", groceries: "shopping-cart",
  family: "home", gym: "dumbbell", "office food": "utensils", "house rent": "home",
  fashion: "shirt", internet: "wifi", paycheck: "banknote", loan: "receipt",
  koko: "credit-card", healthcare: "heart-pulse", electronic: "phone",
  subscriptions: "repeat", gifts: "gift", investments: "trending-up",
  entertainment: "clapperboard", food: "utensils", expenses: "shapes", house: "home",
  pawn: "gem", gold: "gem", seettuwa: "piggy-bank", "family loan": "receipt",
};

/**
 * Works out which categories from the import don't exist yet, disambiguating
 * a name that's used with both kinds in the file (e.g. "Car" as both an
 * expense and, once, an income) so each kind gets its own category.
 */
export function planNewCategories(
  rows: ImportedRow[],
  existing: FinCategory[]
): CategoryPlanEntry[] {
  const existingKeys = new Set(existing.map((c) => `${c.name.toLowerCase()}|${c.kind}`));
  const namesByKind = new Map<CategoryKind, Set<string>>([["EXPENSE", new Set()], ["INCOME", new Set()]]);
  for (const c of existing) namesByKind.get(c.kind)!.add(c.name.toLowerCase());

  const neededKeys = new Map<string, { name: string; kind: CategoryKind }>();
  for (const r of rows) {
    const key = `${r.categoryName.toLowerCase()}|${r.kind}`;
    if (!existingKeys.has(key) && !neededKeys.has(key)) {
      neededKeys.set(key, { name: r.categoryName, kind: r.kind });
      namesByKind.get(r.kind)!.add(r.categoryName.toLowerCase());
    }
  }

  const otherKind = (k: CategoryKind): CategoryKind => (k === "EXPENSE" ? "INCOME" : "EXPENSE");
  const colors = ["#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#22c55e", "#16a34a", "#84cc16", "#eab308"];

  let i = 0;
  const plan: CategoryPlanEntry[] = [];
  for (const { name, kind } of neededKeys.values()) {
    const usedInOtherKind = namesByKind.get(otherKind(kind))!.has(name.toLowerCase());
    const displayName = usedInOtherKind ? `${name} (${kind === "INCOME" ? "Income" : "Expense"})` : name;
    const icon = KEYWORD_ICONS[name.toLowerCase()] ?? "shapes";
    plan.push({ name: displayName, originalName: name, kind, icon, color: colors[i % colors.length] });
    i++;
  }
  return plan;
}

/** Skips rows that already exist (same date + kind + amount + note) to avoid duplicate imports. */
export function dedupeAgainstExisting(rows: ImportedRow[], existing: FinTransaction[]): {
  toImport: ImportedRow[];
  skipped: number;
} {
  const keys = new Set(existing.map((t) => `${t.date}|${t.kind}|${t.amount}|${t.note ?? ""}`));
  const toImport: ImportedRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const key = `${r.date}|${r.kind}|${r.amount}|${r.note}`;
    if (keys.has(key)) { skipped++; continue; }
    keys.add(key); // guard against duplicate rows within the file itself
    toImport.push(r);
  }
  return { toImport, skipped };
}
