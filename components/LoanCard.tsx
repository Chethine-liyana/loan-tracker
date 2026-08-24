"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  calcAccruedInterest,
  calcEmiBreakdown,
  calcInterestRatio,
  daysElapsed,
  dailyCost,
  formatLKR,
  formatRs,
} from "@/lib/calculations";
import PaymentModal from "@/components/PaymentModal";
import EditLoanModal from "@/components/EditLoanModal";
import type { Loan } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface Props {
  loan: Loan;
  onUpdated: () => void;
}

const LOAN_TYPE_META = {
  GOLD_PAWN: { label: "Gold Pawn", emoji: "🪙", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  HOUSING:   { label: "Home Loan", emoji: "🏠", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
};

// ── Stat cell used in the 6-column housing grid ───────────────
function StatCell({
  label, value, valueClass = "",
}: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-bold break-all ${valueClass || "text-gray-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

export default function LoanCard({ loan, onUpdated }: Props) {
  const [expanded,    setExpanded]    = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const meta        = LOAN_TYPE_META[loan.loan_type] ?? LOAN_TYPE_META.GOLD_PAWN;
  const accruedNow  = calcAccruedInterest(loan.current_principal_remaining, loan.annual_interest_rate, loan.last_payment_date);
  const days        = daysElapsed(loan.last_payment_date);
  const payoffToday = loan.current_principal_remaining + accruedNow;
  const repaidPct   = loan.initial_amount > 0
    ? Math.min(((loan.initial_amount - loan.current_principal_remaining) / loan.initial_amount) * 100, 100)
    : 0;

  // ── Housing-specific calculations ─────────────────────────
  const isHousing = loan.loan_type === "HOUSING";
  const hasEmi    = isHousing && loan.monthly_emi && loan.monthly_emi > 0;
  const hasTenure = isHousing && loan.loan_tenure_months && loan.loan_tenure_months > 0;

  const emiData = hasEmi && hasTenure
    ? calcEmiBreakdown(
        loan.current_principal_remaining,
        loan.annual_interest_rate,
        loan.monthly_emi!,
        loan.start_date,
        loan.loan_tenure_months!
      )
    : null;

  // For housing: daily interest
  const daily = dailyCost(loan.current_principal_remaining, loan.annual_interest_rate);

  // Interest summary
  const interestPaidRecorded = loan.total_historical_interest_paid;
  const totalInterestSoFar   = interestPaidRecorded + accruedNow;
  const interestRatio        = calcInterestRatio(totalInterestSoFar, loan.initial_amount);
  const principalPaid        = Math.max(loan.initial_amount - loan.current_principal_remaining, 0);

  async function handleDelete() {
    if (!confirm(`Delete the ${loan.bank_name} loan? This cannot be undone.`)) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("loans").delete().eq("id", loan.id);
    onUpdated();
  }

  return (
    <>
      <div className="card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">

        {/* ── Header — always visible ── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left flex items-start justify-between gap-4"
        >
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
              {loan.bank_name}
            </h3>
            {(loan.branch || loan.ticket_no || loan.property_collateral) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                {[loan.branch, loan.ticket_no ? `#${loan.ticket_no}` : null, loan.property_collateral]
                  .filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="text-amber-600 dark:text-amber-400 font-medium">{loan.annual_interest_rate}% p.a.</span>
              {" · "}Last paid {format(new Date(loan.last_payment_date), "dd MMM yyyy")}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Principal</p>
            <p className="font-bold text-gray-900 dark:text-white text-base">
              {formatLKR(loan.current_principal_remaining)}
            </p>
          </div>
        </button>

        {/* ── Collapsed strip ── */}
        {!expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700
                          flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Accruing: {formatLKR(accruedNow)}
            </span>
            <span>{days} days elapsed · Tap to expand ▾</span>
          </div>
        )}

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="mt-5 space-y-4">

            {/* Principal repayment progress bar */}
            {loan.initial_amount > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <span className="font-semibold uppercase tracking-wide">Principal Repaid</span>
                  <span className="font-semibold">{repaidPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${repaidPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-gray-400 dark:text-gray-500">
                    Started: {formatLKR(loan.initial_amount)}
                    {loan.start_date && (
                      <span className="ml-1">({format(new Date(loan.start_date), "dd MMM yyyy")})</span>
                    )}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Repaid: {formatLKR(principalPaid)}
                  </span>
                </div>
              </div>
            )}

            {/* ── HOUSING: Monthly EMI Breakdown ── */}
            {isHousing && emiData && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-3">
                  🏦 Monthly EMI Breakdown
                </p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Monthly EMI</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white break-all">
                      {formatRs(loan.monthly_emi!)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Interest portion</p>
                    <p className="text-base font-bold text-red-600 dark:text-red-400 break-all">
                      {formatRs(emiData.interestPortion)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Principal portion</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 break-all">
                      {formatRs(emiData.principalPortion)}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Tenure left: </span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {emiData.tenureLeftMonths} mo
                  </span>
                </div>
              </div>
            )}

            {/* ── HOUSING: 6-column stats grid ── */}
            {isHousing ? (
              <div className="grid grid-cols-3 gap-2">
                <StatCell
                  label="Outstanding"
                  value={formatRs(loan.current_principal_remaining)}
                  valueClass="text-red-600 dark:text-red-400"
                />
                <StatCell
                  label="Annual Rate"
                  value={`${loan.annual_interest_rate}%`}
                  valueClass="text-amber-600 dark:text-amber-400"
                />
                <StatCell
                  label="Accrued"
                  value={formatRs(accruedNow)}
                  valueClass="text-amber-700 dark:text-amber-300"
                />
                <StatCell
                  label="Daily Interest"
                  value={formatRs(daily)}
                  valueClass="text-orange-600 dark:text-orange-400"
                />
                <StatCell
                  label="Interest Paid"
                  value={formatRs(interestPaidRecorded)}
                  valueClass="text-emerald-600 dark:text-emerald-400"
                />
                <StatCell
                  label="Principal Paid"
                  value={formatRs(principalPaid)}
                  valueClass="text-emerald-600 dark:text-emerald-400"
                />
              </div>
            ) : (
              /* ── GOLD PAWN: original 4-cell stats grid ── */
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Days since last payment</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{days}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Since {format(new Date(loan.last_payment_date), "dd MMM yyyy")}
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Live interest accrued</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 break-all">
                    {formatLKR(accruedNow)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">As of right now</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current principal</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white break-all">
                    {formatLKR(loan.current_principal_remaining)}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total interest paid</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white break-all">
                    {formatLKR(loan.total_historical_interest_paid)}
                  </p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/15 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Interest per day</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400 break-all">
                    {formatLKR(daily)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    ≈ {formatLKR(daily * 30)} / month at the current rate
                  </p>
                </div>
              </div>
            )}

            {/* ── HOUSING: Interest Summary panel ── */}
            {isHousing && (
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl overflow-hidden">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest px-4 pt-3 pb-2">
                  💡 Interest Summary
                </p>
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Interest paid (recorded)</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {formatRs(interestPaidRecorded)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Currently accrued</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {formatRs(accruedNow)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total interest cost so far</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {formatRs(totalInterestSoFar)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 bg-white/60 dark:bg-gray-700/60">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Interest as % of original loan
                    </span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                      {interestRatio.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── GOLD PAWN: Payoff callout ── */}
            {!isHousing && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800
                              rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Exact payoff today
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Principal + accrued interest now
                  </p>
                </div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400 break-all shrink-0">
                  {formatLKR(payoffToday)}
                </p>
              </div>
            )}

            {/* ── HOUSING: Payoff callout (uses Rs. prefix) ── */}
            {isHousing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800
                              rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    Full payoff today
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
                    Outstanding + accrued interest
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400 break-all shrink-0">
                  {formatRs(payoffToday)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowPayment(true)} className="btn-primary flex-1">
                Log Payment
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="btn-secondary px-4"
                title="Edit loan"
              >
                ✏️
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger px-4"
                title="Delete loan"
              >
                {deleting ? "…" : "🗑"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal loan={loan} onClose={() => setShowPayment(false)} onPaid={onUpdated} />
      )}
      {showEdit && (
        <EditLoanModal loan={loan} onClose={() => setShowEdit(false)} onSaved={onUpdated} />
      )}
    </>
  );
}
