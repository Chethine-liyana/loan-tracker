export type LoanType = 'GOLD_PAWN' | 'HOUSING';

export interface Loan {
  id: string;
  user_id: string;
  bank_name: string;
  branch: string;
  ticket_no: string;
  loan_type: LoanType;
  initial_amount: number;          // original advanced/loan amount
  start_date: string;              // date the loan was originally taken
  last_payment_date: string;       // ISO timestamp of most recent payment
  annual_interest_rate: number;    // e.g. 14.84 means 14.84%
  current_principal_remaining: number;
  total_historical_interest_paid: number;
  created_at: string;

  // Housing-loan-specific (nullable for GOLD_PAWN)
  monthly_emi?: number | null;          // fixed monthly EMI amount
  loan_tenure_months?: number | null;   // total tenure in months (e.g. 84, 120, 240)
  property_collateral?: string | null;  // property description / collateral location

  // Gold-pawn-specific (nullable for HOUSING)
  renewal_date?: string | null;  // ticket must be renewed / paid off by this date, or risks auction
}

export interface NewLoanPayload {
  bank_name: string;
  branch: string;
  ticket_no: string;
  loan_type: LoanType;
  initial_amount: number;
  start_date: string;
  last_payment_date: string;
  annual_interest_rate: number;
  current_principal_remaining: number;
  opening_accrued_interest: number; // interest already accrued at time of entry

  // Housing-loan-specific
  monthly_emi?: number;
  loan_tenure_months?: number;
  property_collateral?: string;

  // Gold-pawn-specific
  renewal_date?: string;
}

export interface PaymentResult {
  accumulated_interest: number;
  principal_reduction: number;
  new_principal: number;
  new_total_interest_paid: number;
}

export interface EmiBreakdown {
  dailyInterest: number;
  interestPortion: number;   // daily * 30.4167
  principalPortion: number;  // emi - interestPortion
  tenureLeftMonths: number;  // months remaining on loan
}

export interface CategoryStats {
  totalPrincipal: number;
  totalInterestPaid: number;
  totalAccruedNow: number;
  count: number;
}

export interface DashboardStats {
  overall: CategoryStats;
  goldPawn: CategoryStats;
  housing: CategoryStats;
}

// ── Smart payment allocation across multiple pawning accounts ──
export interface PawnAccountInput {
  id: string;
  bank_name: string;
  ticket_no: string;
  principal: number;
  rate: number;
  lastPaymentDate: string;
  totalHistoricalInterestPaid: number;
}

export interface AllocationItem {
  loanId: string;
  assignedPayment: number;
  accruedInterest: number;
  dailyInterest: number;
  daysElapsed: number;
  principalReduction: number;
  newPrincipal: number;
  newTotalInterestPaid: number;
}

export interface AllocationPlan {
  items: AllocationItem[];
  totalAssigned: number;
  leftover: number; // couldn't be usefully allocated (would overpay every selected loan)
}

// ── Point-in-time record of a loan's principal + rate (drives the interest trend chart) ──
export interface LoanSnapshot {
  id: string;
  user_id: string;
  loan_id: string;
  recorded_at: string; // YYYY-MM-DD
  principal: number;
  annual_rate: number;
  event: 'BASELINE' | 'PAYMENT' | 'ADJUSTMENT';
  created_at: string;
}
