import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
  getDaysInMonth,
  differenceInCalendarDays,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import type {
  FinAccount,
  AccountWithBalance,
  FinTransaction,
  FinCategory,
  FinBudget,
  BudgetWithSpend,
  RecurrenceFrequency,
  DateRange,
  RangePreset,
} from "@/types/budget";

// ── Currency ────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const CURRENCY_CODES = [
  "USD", "EUR", "GBP", "LKR", "INR", "JPY", "AUD", "CAD", "SGD", "AED",
];

// ── Default categories (seeded for a brand-new user) ────────────
export const DEFAULT_CATEGORIES: {
  name: string;
  icon: string;
  color: string;
  kind: "INCOME" | "EXPENSE";
}[] = [
  { name: "Food & Drink", icon: "utensils", color: "#f97316", kind: "EXPENSE" },
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e", kind: "EXPENSE" },
  { name: "Transport", icon: "car", color: "#3b82f6", kind: "EXPENSE" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899", kind: "EXPENSE" },
  { name: "Bills & Utilities", icon: "receipt", color: "#ef4444", kind: "EXPENSE" },
  { name: "Housing", icon: "home", color: "#a855f7", kind: "EXPENSE" },
  { name: "Health", icon: "heart-pulse", color: "#f43f5e", kind: "EXPENSE" },
  { name: "Entertainment", icon: "clapperboard", color: "#eab308", kind: "EXPENSE" },
  { name: "Travel", icon: "plane", color: "#06b6d4", kind: "EXPENSE" },
  { name: "Education", icon: "graduation-cap", color: "#6366f1", kind: "EXPENSE" },
  { name: "Subscriptions", icon: "repeat", color: "#8b5cf6", kind: "EXPENSE" },
  { name: "Other", icon: "shapes", color: "#64748b", kind: "EXPENSE" },
  { name: "Salary", icon: "banknote", color: "#16a34a", kind: "INCOME" },
  { name: "Freelance", icon: "briefcase", color: "#0ea5e9", kind: "INCOME" },
  { name: "Investments", icon: "trending-up", color: "#059669", kind: "INCOME" },
  { name: "Gifts", icon: "gift", color: "#d946ef", kind: "INCOME" },
  { name: "Other Income", icon: "circle-dollar-sign", color: "#84cc16", kind: "INCOME" },
];

// ── Account balances ─────────────────────────────────────────────
/**
 * Compute each account's live balance from starting_balance + all transactions.
 * EXPENSE and outgoing TRANSFER reduce balance; INCOME and incoming TRANSFER increase it.
 */
export function computeAccountBalances(
  accounts: FinAccount[],
  transactions: FinTransaction[]
): AccountWithBalance[] {
  const balances = new Map<string, number>();
  for (const a of accounts) balances.set(a.id, a.starting_balance);

  for (const t of transactions) {
    if (t.kind === "INCOME") {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) + t.amount);
    } else if (t.kind === "EXPENSE") {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - t.amount);
    } else if (t.kind === "TRANSFER") {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - t.amount);
      if (t.to_account_id) {
        balances.set(t.to_account_id, (balances.get(t.to_account_id) ?? 0) + t.amount);
      }
    }
  }

  return accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? a.starting_balance }));
}

// ── Recurring transactions ───────────────────────────────────────
export function nextOccurrence(date: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case "DAILY": return addDays(date, 1);
    case "WEEKLY": return addWeeks(date, 1);
    case "MONTHLY": return addMonths(date, 1);
    case "YEARLY": return addYears(date, 1);
  }
}

// ── Date range presets ───────────────────────────────────────────
export function rangeForPreset(preset: RangePreset, year: number, month: number): DateRange {
  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  const now = new Date();
  switch (preset) {
    case "THIS_MONTH": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ymd(startOfMonth(d)), to: ymd(endOfMonth(d)) };
    }
    case "LAST_MONTH": {
      const d = subMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
      return { from: ymd(startOfMonth(d)), to: ymd(endOfMonth(d)) };
    }
    case "THIS_YEAR": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: ymd(startOfYear(d)), to: ymd(endOfYear(d)) };
    }
    case "ALL_TIME":
      return { from: "1970-01-01", to: "2100-12-31" };
    case "CUSTOM":
    default: {
      const d = new Date(year, month - 1, 1);
      return { from: ymd(startOfMonth(d)), to: ymd(endOfMonth(d)) };
    }
  }
}

// ── Budget pacing ─────────────────────────────────────────────────
export type BudgetStatus = "on-track" | "warning" | "over";

export interface BudgetPace {
  pctSpent: number;      // 0-100+
  pctElapsed: number;    // % of the month elapsed
  status: BudgetStatus;
  aheadOfPace: boolean;  // spending faster than the days-elapsed pace
}

/** Compares spend-so-far against how far through the month we are. */
export function calcBudgetPace(spent: number, limit: number, month: number, year: number): BudgetPace {
  const now = new Date();
  const isCurrentPeriod = now.getFullYear() === year && now.getMonth() + 1 === month;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const dayOfMonth = isCurrentPeriod ? now.getDate() : daysInMonth;

  const pctSpent = limit > 0 ? (spent / limit) * 100 : 0;
  const pctElapsed = (dayOfMonth / daysInMonth) * 100;

  const status: BudgetStatus = pctSpent >= 100 ? "over" : pctSpent >= 75 ? "warning" : "on-track";

  return {
    pctSpent,
    pctElapsed,
    status,
    aheadOfPace: pctSpent > pctElapsed,
  };
}

// ── Safe-to-spend / burn rate ─────────────────────────────────────
export function calcSafeToSpend(totalBudget: number, spentSoFar: number): {
  remaining: number;
  daysLeft: number;
  perDay: number;
} {
  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const daysLeft = Math.max(daysInMonth - now.getDate() + 1, 1);
  const remaining = Math.max(totalBudget - spentSoFar, 0);
  return { remaining, daysLeft, perDay: remaining / daysLeft };
}

// ── Export ────────────────────────────────────────────────────────
export function toCSV(transactions: FinTransaction[], lookups: {
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
}): string {
  const header = ["Date", "Type", "Amount", "Account", "To Account", "Category", "Note"];
  const rows = transactions.map((t) => [
    t.date,
    t.kind,
    t.amount.toFixed(2),
    lookups.accountName(t.account_id),
    t.to_account_id ? lookups.accountName(t.to_account_id) : "",
    lookups.categoryName(t.category_id),
    (t.note ?? "").replace(/"/g, '""'),
  ]);
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v}"` : v);
  return [header, ...rows].map((r) => r.map((c) => escape(String(c))).join(",")).join("\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function daysElapsedTolerantOfFuture(dateStr: string): number {
  return Math.max(differenceInCalendarDays(new Date(), new Date(dateStr)), 0);
}

// ── Chart data builders ──────────────────────────────────────────

/** Cumulative expense-per-day within `range`, plus the same shape for the equivalent prior period. */
export function buildSpendTrend(transactions: FinTransaction[], range: DateRange) {
  const from = parseISO(range.from);
  const to = parseISO(range.to);
  const days = eachDayOfInterval({ start: from, end: to });
  const spanDays = days.length;

  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(spanDays - 1));
  const prevDays = eachDayOfInterval({ start: prevFrom, end: prevTo });

  const byDay = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "EXPENSE") continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }

  let running = 0;
  let prevRunning = 0;
  return days.map((d, i) => {
    const key = format(d, "yyyy-MM-dd");
    running += byDay.get(key) ?? 0;
    const prevKey = format(prevDays[i], "yyyy-MM-dd");
    prevRunning += byDay.get(prevKey) ?? 0;
    return {
      date: key,
      label: format(d, "MMM d"),
      cumulative: running,
      dayAmount: byDay.get(key) ?? 0,
      previousCumulative: prevRunning,
    };
  });
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
  pct: number;
}

export function buildCategoryBreakdown(
  transactions: FinTransaction[],
  categories: FinCategory[],
  kind: "EXPENSE" | "INCOME" = "EXPENSE"
): CategorySlice[] {
  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== kind || !t.category_id) continue;
    byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + t.amount);
  }
  const total = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return Array.from(byCategory.entries())
    .map(([categoryId, amt]) => {
      const cat = catMap.get(categoryId);
      return {
        categoryId,
        name: cat?.name ?? "Unknown",
        color: cat?.color ?? "#64748b",
        icon: cat?.icon ?? "shapes",
        total: amt,
        pct: total > 0 ? (amt / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Joins raw budget rows with their category and how much has actually been spent that period. */
export function buildBudgetsWithSpend(
  budgets: FinBudget[],
  categories: FinCategory[],
  transactions: FinTransaction[],
  month: number,
  year: number
): BudgetWithSpend[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;

  return budgets
    .filter((b) => b.month === month && b.year === year)
    .map((b) => {
      const spent = transactions
        .filter((t) => t.kind === "EXPENSE" && t.category_id === b.category_id && t.date.startsWith(prefix))
        .reduce((s, t) => s + t.amount, 0);
      return { ...b, spent, category: catMap.get(b.category_id)! };
    })
    .filter((b) => !!b.category)
    .sort((a, b) => a.category.name.localeCompare(b.category.name));
}

export function buildMonthlyInflowOutflow(transactions: FinTransaction[], months = 6) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = subMonths(startOfMonth(now), months - 1 - i);
    return { start: d, end: endOfMonth(d), label: format(d, "MMM"), income: 0, expense: 0 };
  });

  for (const t of transactions) {
    const d = parseISO(t.date);
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (!bucket) continue;
    if (t.kind === "INCOME") bucket.income += t.amount;
    else if (t.kind === "EXPENSE") bucket.expense += t.amount;
  }

  return buckets.map(({ label, income, expense }) => ({ label, income, expense }));
}
