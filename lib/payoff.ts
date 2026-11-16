import { addMonths, differenceInCalendarDays } from "date-fns";
import { calcAccruedInterest, dailyCost, daysElapsed, processPayment, recommendAllocation } from "@/lib/calculations";
import type { AllocationItem, AllocationPlan, PawnAccountInput } from "@/types";

/**
 * How money left over after interest is spread across principal:
 *  - HIGHEST_RATE: all of it to the highest-rate pawn until it's cleared, then the next
 *    (lowest total interest on reducing-balance loans). Equal rates → smaller balance first.
 *  - BY_BALANCE:   in proportion to each pawn's balance (the original splitter).
 *  - LOWEST_RATE:  the reverse of HIGHEST_RATE — shown for comparison only.
 */
export type PayoffMethod = "HIGHEST_RATE" | "BY_BALANCE" | "LOWEST_RATE";

export const PAYOFF_METHODS: { value: PayoffMethod; label: string; hint: string }[] = [
  { value: "HIGHEST_RATE", label: "Highest rate first", hint: "Extra goes to the most expensive pawn until it's cleared" },
  { value: "BY_BALANCE",   label: "Split by balance",   hint: "Extra is shared in proportion to each balance" },
  { value: "LOWEST_RATE",  label: "Lowest rate first",  hint: "Extra goes to the cheapest pawn first" },
];

interface Balance { id: string; principal: number; rate: number }

/** Pay order for the rate-first methods. Ties go to the smaller balance so that gold comes back sooner. */
function payOrder<T extends Balance>(loans: T[], method: PayoffMethod): T[] {
  const dir = method === "LOWEST_RATE" ? 1 : -1;
  return loans.slice().sort((a, b) => dir * (a.rate - b.rate) || a.principal - b.principal);
}

/**
 * Split `amount` across principal. Mutates nothing; returns principal paid per loan id
 * and whatever couldn't be used because every balance was cleared.
 */
function splitPrincipal(loans: Balance[], amount: number, method: PayoffMethod): { paid: Map<string, number>; left: number } {
  const paid = new Map(loans.map((l) => [l.id, 0]));
  let left = amount;

  if (method === "BY_BALANCE") {
    // Proportional to balance, capping any loan at its own principal and re-sharing the excess (water-filling).
    let pool = loans.filter((l) => l.principal > 0.005);
    while (left > 0.005 && pool.length > 0) {
      const total = pool.reduce((s, l) => s + l.principal - (paid.get(l.id) ?? 0), 0);
      if (total <= 0.005) break;
      let capped = false;
      for (const l of pool) {
        const owed = l.principal - (paid.get(l.id) ?? 0);
        if (left * (owed / total) >= owed - 0.005) {
          paid.set(l.id, l.principal);
          left -= owed;
          capped = true;
        }
      }
      if (capped) {
        pool = pool.filter((l) => (paid.get(l.id) ?? 0) < l.principal - 0.005);
      } else {
        for (const l of pool) {
          const owed = l.principal - (paid.get(l.id) ?? 0);
          paid.set(l.id, (paid.get(l.id) ?? 0) + left * (owed / total));
        }
        left = 0;
      }
    }
    return { paid, left: Math.max(left, 0) };
  }

  for (const l of payOrder(loans, method)) {
    if (left <= 0.005) break;
    const x = Math.min(left, l.principal);
    paid.set(l.id, x);
    left -= x;
  }
  return { paid, left: Math.max(left, 0) };
}

/** Pay `amount` against interest owed: all of it if possible, otherwise shared in proportion to what's owed. */
function payInterest(owed: Map<string, number>, amount: number): { paid: Map<string, number>; left: number } {
  const total = Array.from(owed.values()).reduce((s, x) => s + x, 0);
  const paid = new Map<string, number>();
  if (total <= 0) {
    owed.forEach((_, id) => paid.set(id, 0));
    return { paid, left: amount };
  }
  const ratio = Math.min(amount / total, 1);
  owed.forEach((x, id) => paid.set(id, x * ratio));
  return { paid, left: Math.max(amount - total, 0) };
}

/**
 * Today's split for `budget` using `method`. Interest owed on every pawn is covered first,
 * exactly like `recommendAllocation`; only the principal part differs between methods.
 */
export function allocateByMethod(loans: PawnAccountInput[], budget: number, method: PayoffMethod): AllocationPlan {
  if (method === "BY_BALANCE") return recommendAllocation(loans, budget);
  if (loans.length === 0 || budget <= 0) {
    return { items: [], totalAssigned: 0, leftover: Math.max(budget, 0) };
  }

  const accrued = new Map(loans.map((l) => [l.id, calcAccruedInterest(l.principal, l.rate, l.lastPaymentDate)]));
  const interest = payInterest(accrued, budget);
  const principal = splitPrincipal(loans, interest.left, method);

  const items: AllocationItem[] = loans
    .map((l): AllocationItem | null => {
      const payment = (interest.paid.get(l.id) ?? 0) + (principal.paid.get(l.id) ?? 0);
      if (payment <= 0.005) return null;
      const result = processPayment(payment, l.principal, l.rate, l.lastPaymentDate, l.totalHistoricalInterestPaid);
      return {
        loanId: l.id,
        assignedPayment: payment,
        accruedInterest: accrued.get(l.id) ?? 0,
        dailyInterest: dailyCost(l.principal, l.rate),
        daysElapsed: daysElapsed(l.lastPaymentDate),
        principalReduction: result.principal_reduction,
        newPrincipal: result.new_principal,
        newTotalInterestPaid: result.new_total_interest_paid,
      };
    })
    .filter((x): x is AllocationItem => x !== null);

  return {
    items,
    totalAssigned: items.reduce((s, i) => s + i.assignedPayment, 0),
    leftover: principal.left,
  };
}

export interface PayoffProjection {
  method: PayoffMethod;
  /** Number of payments until every pawn is cleared; null if the payment never gets ahead of the interest. */
  payments: number | null;
  finishDate: Date | null;
  totalInterest: number;
  /** When each pawn is cleared, in order. */
  cleared: { loanId: string; payment: number; date: Date }[];
}

const MAX_PAYMENTS = 600; // 50 years — anything longer is reported as "never"

/**
 * Project paying `monthly` today and on the same day each month after, with daily simple
 * interest on the remaining balance (reducing balance), rates unchanged.
 */
export function projectPayoff(loans: PawnAccountInput[], monthly: number, method: PayoffMethod, today = new Date()): PayoffProjection {
  const state = loans.map((l) => ({
    id: l.id,
    principal: l.principal,
    rate: l.rate,
    owed: calcAccruedInterest(l.principal, l.rate, l.lastPaymentDate),
  }));
  let totalInterest = state.reduce((s, l) => s + l.owed, 0);
  const cleared: PayoffProjection["cleared"] = [];
  let prev = today;

  for (let k = 0; k < MAX_PAYMENTS; k++) {
    const date = addMonths(today, k);
    if (k > 0) {
      const days = differenceInCalendarDays(date, prev);
      for (const l of state) {
        const i = l.principal * (l.rate / 100) * (days / 365);
        l.owed += i;
        totalInterest += i;
      }
    }
    prev = date;

    const interest = payInterest(new Map(state.map((l) => [l.id, l.owed])), monthly);
    const open = state.filter((l) => l.principal > 0.005);
    const principal = splitPrincipal(open, interest.left, method);
    for (const l of state) {
      l.owed -= interest.paid.get(l.id) ?? 0;
      l.principal -= principal.paid.get(l.id) ?? 0;
      if (l.principal <= 0.005 && !cleared.some((c) => c.loanId === l.id)) {
        l.principal = 0;
        cleared.push({ loanId: l.id, payment: k + 1, date });
      }
    }

    if (state.every((l) => l.principal <= 0.005 && l.owed <= 0.005)) {
      return { method, payments: k + 1, finishDate: date, totalInterest, cleared };
    }
  }
  return { method, payments: null, finishDate: null, totalInterest, cleared };
}
