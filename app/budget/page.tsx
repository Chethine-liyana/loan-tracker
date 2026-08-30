"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeAccountBalances, buildBudgetsWithSpend, rangeForPreset, DEFAULT_CATEGORIES,
} from "@/lib/budget/calculations";
import TimeRangeFilter from "@/components/budget/TimeRangeFilter";
import OverviewPanel from "@/components/budget/OverviewPanel";
import TransactionsPanel from "@/components/budget/TransactionsPanel";
import BudgetsPanel from "@/components/budget/BudgetsPanel";
import AccountsPanel from "@/components/budget/AccountsPanel";
import SettingsPanel from "@/components/budget/SettingsPanel";
import TransactionFormModal from "@/components/budget/TransactionFormModal";
import type {
  FinAccount, FinCategory, FinTransaction, FinBudget, FinRecurring, RangePreset,
} from "@/types/budget";

type Tab = "overview" | "transactions" | "budgets" | "accounts" | "settings";

const TABS: { value: Tab; label: string; emoji: string }[] = [
  { value: "overview", label: "Overview", emoji: "📊" },
  { value: "transactions", label: "Transactions", emoji: "📝" },
  { value: "budgets", label: "Budgets", emoji: "🎯" },
  { value: "accounts", label: "Accounts", emoji: "👛" },
  { value: "settings", label: "Settings", emoji: "⚙️" },
];

const now = new Date();

export default function BudgetPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [transactions, setTransactions] = useState<FinTransaction[]>([]);
  const [rawBudgets, setRawBudgets] = useState<FinBudget[]>([]);
  const [recurring, setRecurring] = useState<FinRecurring[]>([]);
  const [currency, setCurrency] = useState("USD");

  const [preset, setPreset] = useState<RangePreset>("THIS_MONTH");
  const [rangeYear, setRangeYear] = useState(now.getFullYear());
  const [rangeMonth, setRangeMonth] = useState(now.getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(rangeForPreset("THIS_MONTH", now.getFullYear(), now.getMonth() + 1).from);
  const [customTo, setCustomTo] = useState(rangeForPreset("THIS_MONTH", now.getFullYear(), now.getMonth() + 1).to);

  const [budgetMonth, setBudgetMonth] = useState(now.getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(now.getFullYear());

  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    let [{ data: profile }, { data: accs }, { data: cats }, { data: txs }, { data: buds }, { data: recs }] =
      await Promise.all([
        supabase.from("fin_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("fin_accounts").select("*").order("created_at", { ascending: true }),
        supabase.from("fin_categories").select("*").order("name", { ascending: true }),
        supabase.from("fin_transactions").select("*").order("date", { ascending: false }),
        supabase.from("fin_budgets").select("*"),
        supabase.from("fin_recurring").select("*").order("next_run_date", { ascending: true }),
      ]);

    if (!profile) {
      await supabase.from("fin_profiles").insert({ user_id: user.id, base_currency: "USD" });
      profile = { user_id: user.id, base_currency: "USD", created_at: new Date().toISOString() };
    }
    setCurrency(profile.base_currency);

    if (!cats || cats.length === 0) {
      const { data: seeded } = await supabase
        .from("fin_categories")
        .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id })))
        .select("*");
      cats = seeded ?? [];
    }

    setAccounts(accs ?? []);
    setCategories(cats ?? []);
    setTransactions(txs ?? []);
    setRawBudgets(buds ?? []);
    setRecurring(recs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Keyboard shortcut: "N" opens the quick-add transaction modal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (e.key.toLowerCase() === "n" && !isTyping && !showQuickAdd) {
        e.preventDefault();
        openQuickAdd();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuickAdd, accounts.length]);

  function openQuickAdd() {
    if (accounts.length === 0) {
      setActiveTab("accounts");
      return;
    }
    setShowQuickAdd(true);
  }

  const accountsWithBalance = useMemo(() => computeAccountBalances(accounts, transactions), [accounts, transactions]);

  const range = useMemo(() => {
    if (preset === "CUSTOM") return { from: customFrom, to: customTo };
    return rangeForPreset(preset, rangeYear, rangeMonth);
  }, [preset, rangeYear, rangeMonth, customFrom, customTo]);

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => t.date >= range.from && t.date <= range.to),
    [transactions, range]
  );

  const budgetsWithSpend = useMemo(
    () => buildBudgetsWithSpend(rawBudgets, categories, transactions, budgetMonth, budgetYear),
    [rawBudgets, categories, transactions, budgetMonth, budgetYear]
  );

  function handlePresetChange(p: RangePreset) {
    setPreset(p);
    if (p !== "CUSTOM") {
      const r = rangeForPreset(p, rangeYear, rangeMonth);
      setCustomFrom(r.from);
      setCustomTo(r.to);
    }
  }

  function handleRangeMonthYear(m: number, y: number) {
    setRangeMonth(m);
    setRangeYear(y);
    const r = rangeForPreset("CUSTOM", y, m);
    setCustomFrom(r.from);
    setCustomTo(r.to);
  }

  if (loading || !userId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Loading budget…</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">N</kbd> anywhere to add a transaction
          </p>
        </div>
        <button onClick={openQuickAdd} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === tab.value
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {(activeTab === "overview" || activeTab === "transactions") && (
        <TimeRangeFilter
          preset={preset} year={rangeYear} month={rangeMonth} customFrom={customFrom} customTo={customTo}
          onPresetChange={handlePresetChange} onYearChange={(y) => handleRangeMonthYear(rangeMonth, y)}
          onMonthChange={(m) => handleRangeMonthYear(m, rangeYear)}
          onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
        />
      )}

      {activeTab === "overview" && (
        <OverviewPanel
          transactions={filteredTransactions}
          allTransactions={transactions}
          categories={categories}
          accounts={accountsWithBalance}
          budgets={budgetsWithSpend}
          rawBudgets={rawBudgets}
          range={range}
          currency={currency}
        />
      )}

      {activeTab === "transactions" && (
        <TransactionsPanel
          userId={userId}
          transactions={filteredTransactions}
          accounts={accounts}
          categories={categories}
          currency={currency}
          onChanged={fetchAll}
        />
      )}

      {activeTab === "budgets" && (
        <BudgetsPanel
          userId={userId}
          budgets={budgetsWithSpend}
          categories={categories}
          transactions={transactions}
          month={budgetMonth}
          year={budgetYear}
          currency={currency}
          onChanged={fetchAll}
          onMonthYearChange={(m, y) => { setBudgetMonth(m); setBudgetYear(y); }}
        />
      )}

      {activeTab === "accounts" && (
        <AccountsPanel userId={userId} accounts={accountsWithBalance} currency={currency} onChanged={fetchAll} />
      )}

      {activeTab === "settings" && (
        <SettingsPanel
          userId={userId}
          currency={currency}
          categories={categories}
          recurring={recurring}
          accounts={accounts}
          allTransactions={transactions}
          onChanged={fetchAll}
        />
      )}

      {showQuickAdd && (
        <TransactionFormModal
          userId={userId}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowQuickAdd(false)}
          onSaved={fetchAll}
        />
      )}
    </>
  );
}
