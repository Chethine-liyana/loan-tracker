"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  processPayment,
  formatLKR,
  calcAccruedInterest,
  daysElapsed,
} from "@/lib/calculations";
import CurrencyInput from "@/components/CurrencyInput";
import { recordSnapshot } from "@/lib/snapshots";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  onClose: () => void;
  onPaid: () => void;
}

export default function PaymentModal({ loan, onClose, onPaid }: Props) {
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accruedNow = calcAccruedInterest(
    loan.current_principal_remaining,
    loan.annual_interest_rate,
    loan.last_payment_date
  );
  const days = daysElapsed(loan.last_payment_date);

  const preview =
    amount > 0
      ? processPayment(
          amount,
          loan.current_principal_remaining,
          loan.annual_interest_rate,
          loan.last_payment_date,
          loan.total_historical_interest_paid
        )
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || amount <= 0) { setError("Enter a valid payment amount."); return; }

    setLoading(true);
    const result = processPayment(
      amount,
      loan.current_principal_remaining,
      loan.annual_interest_rate,
      loan.last_payment_date,
      loan.total_historical_interest_paid
    );

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("loans")
      .update({
        current_principal_remaining:    result.new_principal,
        total_historical_interest_paid: result.new_total_interest_paid,
        last_payment_date:              new Date().toISOString(),
      })
      .eq("id", loan.id);

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    await recordSnapshot(supabase, {
      userId: loan.user_id, loanId: loan.id, principal: result.new_principal,
      rate: loan.annual_interest_rate, event: "PAYMENT",
    });
    onPaid();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div className="modal-panel max-w-md w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
          Log Payment
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {loan.bank_name}
          {loan.ticket_no ? ` · #${loan.ticket_no}` : ""}
        </p>

        {/* Current snapshot */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800
                        rounded-xl p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Days since last payment</span>
            <span className="font-semibold dark:text-white">{days} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Interest accrued today</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {formatLKR(accruedNow)}
            </span>
          </div>
          <div className="flex justify-between border-t border-amber-200 dark:border-amber-800 pt-2 mt-2">
            <span className="text-gray-600 dark:text-gray-400">Principal remaining</span>
            <span className="font-semibold dark:text-white">
              {formatLKR(loan.current_principal_remaining)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Payment Amount (LKR)
            </label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              className="input-field text-lg font-semibold"
              required
            />
          </div>

          {/* Live payment breakdown */}
          {preview && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200
                            dark:border-emerald-800 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
                Payment breakdown
              </p>
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>→ Covers interest</span>
                <span>{formatLKR(Math.min(amount, preview.accumulated_interest))}</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>→ Reduces principal</span>
                <span>{formatLKR(preview.principal_reduction)}</span>
              </div>
              <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2
                              flex justify-between font-semibold text-emerald-900 dark:text-emerald-300">
                <span>New principal</span>
                <span>{formatLKR(preview.new_principal)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700
                            text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving…" : "Submit Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
