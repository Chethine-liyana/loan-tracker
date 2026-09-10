"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { reverseCalcRate } from "@/lib/calculations";
import type { LoanType, NewLoanPayload } from "@/types";

interface Props {
  defaultType?: LoanType;
  onClose: () => void;
  onAdded: () => void;
}

const LOAN_TYPES: { value: LoanType; label: string; emoji: string; sub: string }[] = [
  { value: "GOLD_PAWN", label: "Gold Pawn", emoji: "🪙", sub: "Pawn ticket" },
  { value: "HOUSING",   label: "House Loan", emoji: "🏠", sub: "Mortgage / EMI" },
];

const DEFAULT_RATES: Record<LoanType, number> = {
  GOLD_PAWN: 18,
  HOUSING: 12,
};

const today = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = (type: LoanType): NewLoanPayload => ({
  bank_name: "",
  branch: "",
  ticket_no: "",
  loan_type: type,
  initial_amount: 0,
  start_date: today,
  last_payment_date: "",
  annual_interest_rate: DEFAULT_RATES[type],
  current_principal_remaining: 0,
  opening_accrued_interest: 0,
  monthly_emi: 0,
  loan_tenure_months: 0,
  property_collateral: "",
  renewal_date: "",
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>;
}

export default function AddLoanModal({ defaultType = "GOLD_PAWN", onClose, onAdded }: Props) {
  const [form, setForm] = useState<NewLoanPayload>(EMPTY_FORM(defaultType));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-calc rate helper state (not persisted to DB)
  const [autoAccrued, setAutoAccrued] = useState<number>(0);
  const [autoDays,    setAutoDays]    = useState<number>(0);

  function setText(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function setNum(field: keyof NewLoanPayload) {
    return (v: number) => setForm((p) => ({ ...p, [field]: v }));
  }

  function handleTypeChange(type: LoanType) {
    setForm((p) => ({ ...p, loan_type: type, annual_interest_rate: DEFAULT_RATES[type] }));
  }

  // Auto-calculate rate: updates form.annual_interest_rate reactively
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

    if (!form.bank_name.trim())                    { setError("Bank / Lender is required.");            return; }
    if (form.initial_amount <= 0)                  { setError("Original loan value must be > 0.");       return; }
    if (form.current_principal_remaining <= 0)     { setError("Current amount due must be > 0.");        return; }
    if (!form.start_date)                          { setError("Start date is required.");                 return; }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setLoading(false); return; }

    const isHousing = form.loan_type === "HOUSING";

    const { error: dbError } = await supabase.from("loans").insert({
      user_id:                        user.id,
      bank_name:                      form.bank_name.trim(),
      branch:                         form.branch.trim(),
      ticket_no:                      form.ticket_no.trim(),
      loan_type:                      form.loan_type,
      initial_amount:                 form.initial_amount,
      start_date:                     new Date(form.start_date).toISOString(),
      last_payment_date:              form.last_payment_date
                                        ? new Date(form.last_payment_date).toISOString()
                                        : new Date(form.start_date).toISOString(),
      annual_interest_rate:           form.annual_interest_rate,
      current_principal_remaining:    form.current_principal_remaining,
      total_historical_interest_paid: form.opening_accrued_interest,
      // Housing-specific (only insert when relevant, null otherwise)
      monthly_emi:          isHousing && form.monthly_emi ? form.monthly_emi : null,
      loan_tenure_months:   isHousing && form.loan_tenure_months ? form.loan_tenure_months : null,
      property_collateral:  isHousing && form.property_collateral?.trim() ? form.property_collateral.trim() : null,
      // Gold-pawn-specific
      renewal_date:         !isHousing && form.renewal_date ? form.renewal_date : null,
    });

    if (dbError) { setError(dbError.message); setLoading(false); return; }
    onAdded();
    onClose();
  }

  const isHousing = form.loan_type === "HOUSING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="modal-panel max-w-md w-full">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-ghost text-xl leading-none px-2 py-0"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Add Account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Loan type ── */}
          <div className="grid grid-cols-2 gap-2">
            {LOAN_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 text-sm transition-all ${
                  form.loan_type === t.value
                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="font-semibold">{t.label}</span>
                <span className="text-xs opacity-70">{t.sub}</span>
              </button>
            ))}
          </div>

          {/* ── Bank details ── */}
          <SectionLabel>Bank / Lender</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Bank / Lender
              </label>
              <input name="bank_name" required value={form.bank_name} onChange={setText}
                     className="input-field" placeholder="e.g. BOC, HNB, Sampath…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Branch
              </label>
              <input name="branch" value={form.branch} onChange={setText}
                     className="input-field" placeholder="e.g. Yakkala" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Account / Ticket No.
            </label>
            <input name="ticket_no" value={form.ticket_no} onChange={setText}
                   className="input-field" placeholder="e.g. 0650191591" />
          </div>

          {/* ── Amounts ── */}
          <SectionLabel>Loan Amounts (LKR)</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Original Loan Value
              </label>
              <CurrencyInput value={form.initial_amount} onChange={setNum("initial_amount")}
                             className="input-field" placeholder="e.g. 4,300,000" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Current Amount Due
              </label>
              <CurrencyInput value={form.current_principal_remaining}
                             onChange={setNum("current_principal_remaining")}
                             className="input-field" placeholder="e.g. 3,932,059" required />
            </div>
          </div>

          {/* ── Annual Interest Rate + Auto-Calc helper ── */}
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
              className="input-field"
              placeholder="e.g. 15"
              onChange={(e) => setForm((p) => ({ ...p, annual_interest_rate: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          {/* AUTO-CALCULATE RATE FROM BANK DATA */}
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

          {/* ── Accrued Interest at entry ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Accrued Interest at Entry{" "}
              <span className="text-gray-400 font-normal">(optional — interest already accrued before this date)</span>
            </label>
            <CurrencyInput value={form.opening_accrued_interest}
                           onChange={setNum("opening_accrued_interest")}
                           className="input-field" placeholder="e.g. 0" />
          </div>

          {/* ── Dates ── */}
          <SectionLabel>Dates</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input type="date" name="start_date" required value={form.start_date}
                     onChange={setText} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Last Payment Date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="date" name="last_payment_date" value={form.last_payment_date}
                     onChange={setText} className="input-field" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Blank = use start date</p>
            </div>
          </div>

          {/* ── Gold-pawn-only: renewal / auction deadline ── */}
          {!isHousing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Renewal / Auction Date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="date" name="renewal_date" value={form.renewal_date ?? ""}
                     onChange={setText} className="input-field" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                When the ticket must be renewed or paid off by — you&apos;ll get a warning as it approaches.
              </p>
            </div>
          )}

          {/* ── Housing-only fields ── */}
          {isHousing && (
            <>
              <SectionLabel>Home Loan Details</SectionLabel>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Monthly EMI (Rs.)
                  </label>
                  <CurrencyInput
                    value={form.monthly_emi ?? 0}
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
                  value={form.property_collateral ?? ""}
                  onChange={setText}
                  className="input-field"
                  placeholder="e.g. Veyangoda, No. 12 Main Street"
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
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving…" : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
