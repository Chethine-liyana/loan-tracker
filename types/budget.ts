export type CategoryKind = "INCOME" | "EXPENSE";
export type TransactionKind = "INCOME" | "EXPENSE" | "TRANSFER";
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type AccountType = "cash" | "bank" | "card" | "savings" | "other";

export interface FinAccount {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  starting_balance: number;
  currency: string;
  archived: boolean;
  created_at: string;
}

/** Account with its live balance computed from transactions. */
export interface AccountWithBalance extends FinAccount {
  balance: number;
}

export interface FinCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  archived: boolean;
  created_at: string;
}

export interface FinTransaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  kind: TransactionKind;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string | null;
  created_at: string;
}

export interface FinBudget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: number;
  year: number;
  recurring: boolean;
  created_at: string;
}

/** Budget joined with how much has been spent this period. */
export interface BudgetWithSpend extends FinBudget {
  spent: number;
  category: FinCategory;
}

export interface FinRecurring {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  kind: "INCOME" | "EXPENSE";
  amount: number;
  note: string | null;
  frequency: RecurrenceFrequency;
  next_run_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export interface FinProfile {
  user_id: string;
  base_currency: string;
  created_at: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export type RangePreset = "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL_TIME" | "CUSTOM";
