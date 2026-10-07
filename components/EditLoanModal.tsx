"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { recordSnapshot } from "@/lib/snapshots";
import { reverseCalcRate } from "@/lib/calculations";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}

interface EditForm {
  bank_name: string;
  branch: string;
  ticket_no: string;
  annual_interest_rate: number;
  current_principal_remaining: number;
  initial_amount: number;
  start_date: string;
  last_payment_date: string;
  // Housing-specific
  monthly_emi: number;
  loan_tenure_months: number;
  property_collateral: string;
  // Gold-pawn-specific
  renewal_date: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="section-label">{children}</p>
  );
}

export default function EditLoanModal({ loan, onClose, onSaved }: Props) {
  const toDateInput = (iso: string) => {
    try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
  };

  const [form, setForm] = useState<EditForm>({
    bank_name:                   loan.bank_name,
    branch:                      loan.branch ?? "",
    ticket_no:                   loan.ticket_no ?? "",
    annual_interest_rate:        loan.annual_interest_rate,
    current_principal_remaining: loan.current_principal_remaining,
    initial_amount:              loan.initial_amount ?? 0,
    start_date:                  toDateInput(loan.start_date ?? ""),
    last_payment_date:           toDateInput(loan.last_payment_date),
    monthly_emi:                 loan.monthly_emi ?? 0,
    loan_tenure_months:          loan.loan_tenure_months ?? 0,
    property_collateral:         loan.property_collateral ?? "",
    renewal_date:                loan.renewal_date ? toDateInput(loan.renewal_date) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-calc rate helper state (ephemeral — not saved to DB)
  const [autoAccrued, setAutoAccrued] = useState<number>(0);
  const [autoDays,    setAutoDays]    = useState<number>(0);

  function setText(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function setNum(field: keyof EditForm) {
    return (v: number) => setForm((p) => ({ ...p, [field]: v }));
  }

  // Reverse-calculate rate from accrued interest + days
  function handleAutoAccruedChange(v: number) {
    setAutoAccrued(v);
    const rate = reverseCalcRate(v, form.current_principal_remaining, autoDays);
    if (rate !== null) {
      setForm((p) => ({ ...p, annual_interest_rate: parseFloat(rate.toFixed(4)) }));
    }
  }

  function handleAutoDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = parseInt(e.target.value) || 0;
    setAutoDays(d);
    const rate = reverseCalcRate(autoAccrued, form.current_principal_remaining, d);
    if (rate !== null) {
      setForm((p) => ({ ...p, annual_interest_rate: parseFloat(rate.toFixed(4)) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.bank_name.trim())               { setError("Bank name is required."); return; }
    if (form.current_principal_remaining < 0) { setError("Principal cannot be negative."); return; }
    if (form.annual_interest_rate <= 0)       { setError("Interest rate must be > 0."); return; }

    setLoading(true);
    const supabase = createClient();

    const isHousing = loan.loan_type === "HOUSING";

    const { error: dbError } = await supabase
      .from("loans")
      .update({
        bank_name:                   form.bank_name.trim(),
        branch:                      form.branch.trim(),
        ticket_no:                   form.ticket_no.trim(),
        annual_interest_rate:        form.annual_interest_rate,
        current_principal_remaining: form.current_principal_remaining,
        initial_amount:              form.initial_amount,
        start_date:                  form.start_date
                                       ? new Date(form.start_date).toISOString()
                                       : loan.start_date ?? null,
        last_payment_date:           form.last_payment_date
                                       ? new Date(form.last_payment_date).toISOString()
                                       : loan.last_payment_date,
        // Housing-specific (only update when loan type is HOUSING)
        monthly_emi:          isHousing ? (form.monthly_emi || null) : null,
        loan_tenure_months:   isHousing ? (form.loan_tenure_months || null) : null,
        property_collateral:  isHousing ? (form.property_collateral.trim() || null) : null,
        // Gold-pawn-specific
        renewal_date:         !isHousing ? (form.renewal_date || null) : null,
      })
      .eq("id", loan.id);

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    if (
      form.current_principal_remaining !== loan.current_principal_remaining ||
      form.annual_interest_rate !== loan.annual_interest_rate
    ) {
      await recordSnapshot(supabase, {
        userId: loan.user_id, loanId: loan.id, principal: form.current_principal_remaining,
        rate: form.annual_interest_rate, event: "ADJUSTMENT",
      });
    }
    onSaved();
    onClose();
  }

  const isHousing = loan.loan_type === "HOUSING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-md w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0"
        >
          ✕
        </button>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Update — {loan.bank_name}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {loan.loan_type === "GOLD_PAWN" ? "🪙 Gold Pawn" : "🏠 Home Loan"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Bank details ── */}
          <SectionLabel>Bank / Lender</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Bank / Lender
              </label>
              <input
                name="bank_name"
                required
                value={form.bank_name}
                onChange={setText}
                className="input-field"
                placeholder="e.g. BOC, HNB…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Branch
              </label>
              <input
                name="branch"
                value={form.branch}
                onChange={setText}
                className="input-field"
                placeholder="e.g. Yakkala"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Account / Ticket No.
            </label>
            <input
              name="ticket_no"
              value={form.ticket_no}
              onChange={setText}
              className="input-field"
              placeholder="e.g. 01"
            />
          </div>

          {/* ── Amounts ── */}
          <SectionLabel>Loan Amounts</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Original Loan Value (Rs.)
              </label>
              <CurrencyInput
                value={form.initial_amount}
                onChange={setNum("initial_amount")}
                className="input-field"
                placeholder="e.g. 4,300,000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Current Amount Due (Rs.)
              </label>
              <CurrencyInput
                value={form.current_principal_remaining}
                onChange={setNum("current_principal_remaining")}
                className="input-field"
                placeholder="e.g. 3,932,059.44"
                required
              />
            </div>
          </div>

          {/* ── Annual Interest Rate ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Annual Interest Rate (%)
            </label>
            <input
              type="number"
              name="annual_interest_rate"
              required
              min={0.01}
              step={0.0001}
              value={form.annual_interest_rate}
              onChange={(e) => setForm((p) => ({ ...p, annual_interest_rate: parseFloat(e.target.value) || 0 }))}
              className="input-field"
              placeholder="e.g. 15"
            />
          </div>

          {/* ── AUTO-CALCULATE RATE FROM BANK DATA ── */}
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-widest">
              🔄 Auto-Calculate Rate From Bank Data
            </p>
            <p className="text-xs text-teal-600 dark:text-teal-400">
              Enter values from your bank statement to reverse-engineer the exact rate.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Accrued interest (Rs.)
                </label>
                <CurrencyInput
                  value={autoAccrued}
                  onChange={handleAutoAccruedChange}
                  className="input-field"
                  placeholder="e.g. 7,412"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Days since last payment
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={autoDays || ""}
                  onChange={handleAutoDaysChange}
                  className="input-field"
                  placeholder="e.g. 18"
                />
              </div>
            </div>
            {autoAccrued > 0 && autoDays > 0 && form.current_principal_remaining > 0 && (
              <p className="text-xs text-teal-600 dark:text-teal-400">
                ✓ Rate auto-set to <strong>{form.annual_interest_rate.toFixed(4)}%</strong>
              </p>
            )}
          </div>

          {/* ── Dates ── */}
          <SectionLabel>Dates</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={setText}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Last Payment Date
              </label>
              <input
                type="date"
                name="last_payment_date"
                value={form.last_payment_date}
                onChange={setText}
                className="input-field"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Interest accrues from this date to today.
              </p>
            </div>
          </div>

          {/* ── Gold-pawn-only: renewal / auction deadline ── */}
          {!isHousing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Renewal / Auction Date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                name="renewal_date"
                value={form.renewal_date}
                onChange={setText}
                className="input-field"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                When the ticket must be renewed or paid off by.
              </p>
            </div>
          )}

          {/* ── Housing-specific fields ── */}
          {isHousing && (
            <>
              <SectionLabel>Home Loan Details</SectionLabel>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Monthly EMI (Rs.)
                  </label>
                  <CurrencyInput
                    value={form.monthly_emi}
                    onChange={setNum("monthly_emi")}
                    className="input-field"
                    placeholder="e.g. 82,583"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Loan Tenure (months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.loan_tenure_months || ""}
                    onChange={(e) => setForm((p) => ({ ...p, loan_tenure_months: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                    placeholder="e.g. 84 (7 yrs), 120 (10 yrs)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Property / Collateral
                </label>
                <input
                  name="property_collateral"
                  value={form.property_collateral}
                  onChange={setText}
                  className="input-field"
                  placeholder="e.g. Veyangoda"
                />
              </div>
            </>
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
              {loading ? "Saving…" : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
