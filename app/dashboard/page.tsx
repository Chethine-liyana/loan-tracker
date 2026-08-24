"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatLKR, calcAccruedInterest, dailyCost } from "@/lib/calculations";
import LoanCard from "@/components/LoanCard";
import AddLoanModal from "@/components/AddLoanModal";
import PaymentPlanner from "@/components/PaymentPlanner";
import PortfolioCharts from "@/components/PortfolioCharts";
import type { Loan, LoanType, CategoryStats, DashboardStats } from "@/types";

type Tab = "GOLD_PAWN" | "HOUSING";

function buildStats(loans: Loan[]): DashboardStats & { totalDailyCost: number } {
  const empty = (): CategoryStats => ({
    totalPrincipal: 0,
    totalInterestPaid: 0,
    totalAccruedNow: 0,
    count: 0,
  });

  const overall  = empty();
  const goldPawn = empty();
  const housing  = empty();
  let totalDailyCost = 0;

  for (const l of loans) {
    const accrued = calcAccruedInterest(l.current_principal_remaining, l.annual_interest_rate, l.last_payment_date);
    const daily   = dailyCost(l.current_principal_remaining, l.annual_interest_rate);
    const bucket  = l.loan_type === "GOLD_PAWN" ? goldPawn : housing;

    bucket.totalPrincipal     += l.current_principal_remaining;
    bucket.totalInterestPaid  += l.total_historical_interest_paid;
    bucket.totalAccruedNow    += accrued;
    bucket.count              += 1;

    overall.totalPrincipal    += l.current_principal_remaining;
    overall.totalInterestPaid += l.total_historical_interest_paid;
    overall.totalAccruedNow   += accrued;
    overall.count             += 1;
    totalDailyCost            += daily;
  }

  return { overall, goldPawn, housing, totalDailyCost };
}

// ── Stat card ───────────────────────────────────────────────
function StatBox({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: "gold" | "red" | "green" | "blue";
}) {
  const valueColor =
    accent === "gold"  ? "text-amber-600 dark:text-amber-400" :
    accent === "red"   ? "text-red-600   dark:text-red-400"   :
    accent === "green" ? "text-emerald-600 dark:text-emerald-400" :
    accent === "blue"  ? "text-blue-600  dark:text-blue-400"  :
    "text-gray-900 dark:text-white";

  return (
    <div className="stat-card">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
        {label}
      </p>
      <p className={`text-xl font-bold mt-1 break-all ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Daily cost highlight card ────────────────────────────────
function DailyCostCard({ amount }: { amount: number }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-red-600
                    dark:from-rose-700 dark:to-red-800 p-5 text-white shadow-sm col-span-2 sm:col-span-1">
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">
        Daily Interest Cost
      </p>
      <p className="text-2xl font-bold break-all">{formatLKR(amount)}</p>
      <p className="text-xs opacity-70 mt-1">Burning every day across all accounts</p>
    </div>
  );
}

// ── Category subtotal strip ──────────────────────────────────
function CategoryStrip({
  label, emoji, stats, color,
}: {
  label: string; emoji: string; stats: CategoryStats; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        {emoji} {label}{" "}
        <span className="font-normal text-gray-400 dark:text-gray-500">
          ({stats.count} loan{stats.count !== 1 ? "s" : ""})
        </span>
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Principal",        value: formatLKR(stats.totalPrincipal),    color: "text-gray-900 dark:text-white" },
          { label: "Pending interest", value: formatLKR(stats.totalAccruedNow),   color: "text-amber-600 dark:text-amber-400" },
          { label: "Interest paid",    value: formatLKR(stats.totalInterestPaid), color: "text-gray-900 dark:text-white" },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{item.label}</p>
            <p className={`text-sm font-bold break-all ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const [loans,     setLoans]     = useState<Loan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("GOLD_PAWN");
  const [showAdd,   setShowAdd]   = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);

  const fetchLoans = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setLoans(data as Loan[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const stats        = buildStats(loans);
  const visibleLoans = loans.filter((l) => l.loan_type === activeTab);

  const TAB_META: Record<Tab, { label: string; emoji: string }> = {
    GOLD_PAWN: { label: "Gold Pawn Portfolio",    emoji: "🪙" },
    HOUSING:   { label: "Housing Loan Portfolio", emoji: "🏠" },
  };

  return (
    <>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Liabilities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loans.length === 0
              ? "No loans yet"
              : `${loans.length} active loan${loans.length !== 1 ? "s" : ""} across all categories`}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Add Account</span>
        </button>
      </div>

      {loans.length > 0 && (
        <>
          {/* ── Global aggregates ── */}
          <section className="mb-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              Overall Summary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <StatBox label="Total Principal Remaining"
                       value={formatLKR(stats.overall.totalPrincipal)}
                       sub="All loans combined" />
              <StatBox label="Total Pending Interest"
                       value={formatLKR(stats.overall.totalAccruedNow)}
                       sub="Live — as of right now"
                       accent="gold" />
              <StatBox label="Total Payoff Amount"
                       value={formatLKR(stats.overall.totalPrincipal + stats.overall.totalAccruedNow)}
                       sub="Principal + accrued"
                       accent="red" />
              <StatBox label="Total Interest Paid"
                       value={formatLKR(stats.overall.totalInterestPaid)}
                       sub="Cumulative historical"
                       accent="green" />
            </div>

            {/* Daily cost — full-width highlight */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-3">
              <DailyCostCard amount={stats.totalDailyCost} />
              <div className="stat-card justify-center">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Monthly Interest Burn
                </p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 break-all">
                  {formatLKR(stats.totalDailyCost * 30)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Approximate (30 days)
                </p>
              </div>
            </div>
          </section>

          {/* ── Category subtotals ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <CategoryStrip label="Gold Pawn" emoji="🪙" stats={stats.goldPawn}
              color="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10" />
            <CategoryStrip label="Housing Loans" emoji="🏠" stats={stats.housing}
              color="border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/10" />
          </section>
        </>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
        {(["GOLD_PAWN", "HOUSING"] as Tab[]).map((tab) => {
          const count = loans.filter((l) => l.loan_type === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                activeTab === tab
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <span>{TAB_META[tab].emoji}</span>
              <span className="hidden sm:inline">{TAB_META[tab].label}</span>
              <span className="sm:hidden">{tab === "GOLD_PAWN" ? "Gold Pawn" : "Housing"}</span>
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  activeTab === tab
                    ? "bg-gray-900 dark:bg-gray-500 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Charts (scoped to the active tab, gold pawn and housing kept separate) ── */}
      <PortfolioCharts
        loans={visibleLoans}
        title={`${TAB_META[activeTab].emoji} ${TAB_META[activeTab].label} — Insights`}
      />

      {/* ── Smart payment splitter entry point (Gold Pawn only) ── */}
      {activeTab === "GOLD_PAWN" && visibleLoans.length > 1 && (
        <button
          onClick={() => setShowPlanner(true)}
          className="w-full mb-5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700
                     bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20
                     text-amber-800 dark:text-amber-300 font-semibold text-sm px-4 py-3
                     flex items-center justify-center gap-2 transition-all duration-150
                     hover:border-amber-400 hover:scale-[1.01] active:scale-[0.99]"
        >
          <span className="text-lg leading-none">🧮</span>
          Split a payment across pawn accounts
        </button>
      )}

      {/* ── Loan cards ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm">Loading accounts…</p>
        </div>
      ) : visibleLoans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">{TAB_META[activeTab].emoji}</span>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No {TAB_META[activeTab].label} accounts yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
            Add your first {activeTab === "GOLD_PAWN" ? "gold pawn" : "housing"} account to start tracking.
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleLoans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onUpdated={fetchLoans} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddLoanModal
          defaultType={activeTab as LoanType}
          onClose={() => setShowAdd(false)}
          onAdded={fetchLoans}
        />
      )}

      {showPlanner && (
        <PaymentPlanner
          loans={loans.filter((l) => l.loan_type === "GOLD_PAWN")}
          onClose={() => setShowPlanner(false)}
          onApplied={fetchLoans}
        />
      )}
    </>
  );
}
