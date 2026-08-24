"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recommendAllocation, formatLKR } from "@/lib/calculations";
import CurrencyInput from "@/components/CurrencyInput";
import type { Loan, PawnAccountInput } from "@/types";

interface Props {
  loans: Loan[]; // gold-pawn accounts only
  onClose: () => void;
  onApplied: () => void;
}

export default function PaymentPlanner({ loans, onClose, onApplied }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(loans.map((l) => l.id))
  );
  const [budget, setBudget] = useState(0);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLoans = loans.filter((l) => selected.has(l.id));

  const inputs: PawnAccountInput[] = useMemo(
    () =>
      selectedLoans.map((l) => ({
        id: l.id,
        bank_name: l.bank_name,
        ticket_no: l.ticket_no,
        principal: l.current_principal_remaining,
        rate: l.annual_interest_rate,
        lastPaymentDate: l.last_payment_date,
        totalHistoricalInterestPaid: l.total_historical_interest_paid,
      })),
    [selectedLoans]
  );

  const plan = useMemo(
    () => recommendAllocation(inputs, budget),
    [inputs, budget]
  );

  function loanFor(id: string) {
    return loans.find((l) => l.id === id)!;
  }

  async function handleApply() {
    if (plan.items.length === 0) return;
    setApplying(true);
    setError(null);

    const supabase = createClient();
    for (const item of plan.items) {
      const { error: dbError } = await supabase
        .from("loans")
        .update({
          current_principal_remaining: item.newPrincipal,
          total_historical_interest_paid: item.newTotalInterestPaid,
          last_payment_date: new Date().toISOString(),
        })
        .eq("id", item.loanId);

      if (dbError) {
        setError(`Failed on ${loanFor(item.loanId).bank_name}: ${dbError.message}`);
        setApplying(false);
        return;
      }
    }

    setApplying(false);
    onApplied();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-2xl w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
          Smart Payment Splitter
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Pick the accounts you&apos;re paying and how much you have to spend —
          we&apos;ll recommend the split.
        </p>

        {loans.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No pawn accounts to plan for yet.
          </p>
        ) : (
          <>
            {/* ── Account picker ── */}
            <div className="space-y-2 mb-5">
              {loans.map((l) => {
                const checked = selected.has(l.id);
                const daily =
                  l.current_principal_remaining * (l.annual_interest_rate / 100) / 365;
                return (
                  <label
                    key={l.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150 ${
                      checked
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(l.id)}
                      className="w-4 h-4 accent-amber-500 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {l.bank_name}
                        {l.ticket_no ? ` · #${l.ticket_no}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatLKR(l.current_principal_remaining)} at{" "}
                        {l.annual_interest_rate}% p.a.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Interest/day</p>
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {formatLKR(daily)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* ── Budget input ── */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Total amount you plan to pay (LKR)
              </label>
              <CurrencyInput
                value={budget}
                onChange={setBudget}
                placeholder="0.00"
                className="input-field text-lg font-semibold"
              />
            </div>

            {/* ── Recommended split ── */}
            {budget > 0 && selectedLoans.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Recommended split
                </p>

                {plan.items.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter a budget above to see a recommendation.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {plan.items
                      .slice()
                      .sort((a, b) => b.assignedPayment - a.assignedPayment)
                      .map((item) => {
                        const loan = loanFor(item.loanId);
                        return (
                          <div
                            key={item.loanId}
                            className="rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 p-3"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {loan.bank_name}
                                {loan.ticket_no ? ` · #${loan.ticket_no}` : ""}
                              </p>
                              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                {formatLKR(item.assignedPayment)}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <span>
                                → Interest{" "}
                                <span className="font-medium text-amber-600 dark:text-amber-400">
                                  {formatLKR(Math.min(item.assignedPayment, item.accruedInterest))}
                                </span>
                              </span>
                              <span>
                                → Principal{" "}
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  {formatLKR(item.principalReduction)}
                                </span>
                              </span>
                              <span className="text-right">
                                New bal.{" "}
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {formatLKR(item.newPrincipal)}
                                </span>
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1 pt-1">
                      <span>Total allocated</span>
                      <span className="font-semibold">{formatLKR(plan.totalAssigned)}</span>
                    </div>

                    {plan.leftover > 0.5 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                        {formatLKR(plan.leftover)} left over — the selected accounts would
                        be fully paid off before using the whole budget.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700
                              text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || plan.items.length === 0}
                className="btn-primary flex-1"
              >
                {applying ? "Applying…" : "Apply Payments"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
