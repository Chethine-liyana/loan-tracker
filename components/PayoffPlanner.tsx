"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatLKR } from "@/lib/calculations";
import { allocateByMethod, projectPayoff, PAYOFF_METHODS, type PayoffMethod } from "@/lib/payoff";
import CurrencyInput from "@/components/CurrencyInput";
import { recordSnapshot } from "@/lib/snapshots";
import type { Loan, PawnAccountInput } from "@/types";

interface Props {
  loans: Loan[]; // active gold-pawn accounts only
  onClose: () => void;
  onApplied: () => void;
}

const loanLabel = (l: Loan) => `${l.bank_name}${l.ticket_no ? ` · #${l.ticket_no}` : ""}`;

export default function PayoffPlanner({ loans, onClose, onApplied }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(loans.map((l) => l.id)));
  const [monthly, setMonthly] = useState(0);
  const [method, setMethod] = useState<PayoffMethod>("HIGHEST_RATE");
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

  const selectedLoans = useMemo(() => loans.filter((l) => selected.has(l.id)), [loans, selected]);

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

  const plan = useMemo(() => allocateByMethod(inputs, monthly, method), [inputs, monthly, method]);

  const projections = useMemo(
    () => (monthly > 0 && inputs.length > 0 ? PAYOFF_METHODS.map((m) => projectPayoff(inputs, monthly, m.value)) : []),
    [inputs, monthly]
  );
  const finishing = projections.filter((p) => p.payments !== null);
  const lowest = finishing.length > 0 ? Math.min(...finishing.map((p) => p.totalInterest)) : null;
  // With one pawn (or equal outcomes) every method costs the same — don't badge any of them.
  const cheapest = lowest !== null && finishing.some((p) => p.totalInterest - lowest >= 0.5) ? lowest : null;
  const chosen = projections.find((p) => p.method === method);

  // Unticked pawns that cost more than every ticked one are easy to forget.
  const maxSelectedRate = Math.max(0, ...selectedLoans.map((l) => l.annual_interest_rate));
  const missedExpensive = loans.filter((l) => !selected.has(l.id) && l.annual_interest_rate > maxSelectedRate);

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
      const loan = loanFor(item.loanId);
      await recordSnapshot(supabase, {
        userId: loan.user_id, loanId: loan.id, principal: item.newPrincipal,
        rate: loan.annual_interest_rate, event: "PAYMENT",
      });
    }

    setApplying(false);
    onApplied();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-2xl w-full">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0">✕</button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Payoff Planner</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Enter what you pay each month to see how long it takes, what it costs, and how to split this payment.
        </p>

        {loans.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No pawn accounts to plan for yet.</p>
        ) : (
          <>
            {/* ── Account picker ── */}
            <div className="space-y-2 mb-3">
              {loans.map((l) => {
                const checked = selected.has(l.id);
                return (
                  <label
                    key={l.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150 ${
                      checked
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(l.id)} className="w-4 h-4 accent-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{loanLabel(l)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatLKR(l.current_principal_remaining)}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">{l.annual_interest_rate}%</span>
                  </label>
                );
              })}
            </div>

            {missedExpensive.length > 0 && selectedLoans.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300 mb-3">
                ⚠️ {missedExpensive.map((l) => `${loanLabel(l)} (${l.annual_interest_rate}%)`).join(", ")}{" "}
                {missedExpensive.length === 1 ? "isn't" : "aren't"} ticked but cost{missedExpensive.length === 1 ? "s" : ""} more than the pawns you picked.
              </div>
            )}

            {/* ── Monthly amount ── */}
            <div className="mb-5 mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Amount you pay each month (LKR)</label>
              <CurrencyInput value={monthly} onChange={setMonthly} placeholder="0.00" className="input-field text-lg font-semibold" />
            </div>

            {monthly > 0 && selectedLoans.length > 0 && (
              <>
                {/* ── Method comparison ── */}
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Pick a method
                </p>
                <div className="space-y-2 mb-2">
                  {PAYOFF_METHODS.map((m) => {
                    const p = projections.find((x) => x.method === m.value);
                    const active = method === m.value;
                    const isCheapest = p?.payments !== null && cheapest !== null && p !== undefined && p.totalInterest - cheapest < 0.5;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${
                          active
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {m.label}
                            {isCheapest && (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                ⭐ Cheapest
                              </span>
                            )}
                          </p>
                          {p?.payments != null && (
                            <p className="text-sm font-bold text-gray-900 dark:text-white shrink-0">{formatLKR(p.totalInterest)}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="truncate">{m.hint}</span>
                          {p?.payments != null ? (
                            <span className="shrink-0">
                              {p.payments} payments · paid off {format(p.finishDate!, "MMM yyyy")}
                              {cheapest !== null && p.totalInterest - cheapest >= 0.5 && (
                                <span className="text-rose-500 dark:text-rose-400"> · +{formatLKR(p.totalInterest - cheapest)}</span>
                              )}
                            </span>
                          ) : (
                            <span className="shrink-0 text-rose-500 dark:text-rose-400">Never paid off</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
                  Total interest from today, paying {formatLKR(monthly)} today and on this date each month, with rates unchanged.
                </p>

                {chosen?.payments === null && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                    {formatLKR(monthly)} a month doesn&apos;t cover the interest, so the balance never goes down. Pay more than about{" "}
                    {formatLKR(selectedLoans.reduce((s, l) => s + l.current_principal_remaining * (l.annual_interest_rate / 100) / 12, 0))} a month.
                  </div>
                )}

                {chosen && chosen.payments !== null && chosen.cleared.length > 1 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Order pawns are cleared</p>
                    <ol className="space-y-1">
                      {chosen.cleared.map((c, i) => (
                        <li key={c.loanId} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                          <span>{i + 1}. {loanLabel(loanFor(c.loanId))}</span>
                          <span className="text-gray-500 dark:text-gray-400">after {c.payment} payments · {format(c.date, "MMM yyyy")}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* ── This payment ── */}
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">This payment</p>
                <div className="space-y-2 mb-5">
                  {plan.items
                    .slice()
                    .sort((a, b) => b.assignedPayment - a.assignedPayment)
                    .map((item) => (
                      <div key={item.loanId} className="rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{loanLabel(loanFor(item.loanId))}</p>
                          <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 shrink-0">{formatLKR(item.assignedPayment)}</p>
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
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatLKR(item.principalReduction)}</span>
                          </span>
                          <span className="text-right">
                            New bal. <span className="font-medium text-gray-800 dark:text-gray-200">{formatLKR(item.newPrincipal)}</span>
                          </span>
                        </div>
                      </div>
                    ))}

                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1 pt-1">
                    <span>Total allocated</span>
                    <span className="font-semibold">{formatLKR(plan.totalAssigned)}</span>
                  </div>

                  {plan.leftover > 0.5 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                      {formatLKR(plan.leftover)} left over — the selected accounts would be fully paid off before using the whole amount.
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Close</button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || plan.items.length === 0}
                className="btn-primary flex-1"
              >
                {applying ? "Saving…" : "I've paid these — save"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2">
              Saving records this payment on each pawn. Only save after you&apos;ve paid the bank.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
