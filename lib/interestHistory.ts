import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { Loan, LoanSnapshot } from "@/types";

export type InterestMetric = "DAILY" | "MONTHLY";
export type HistoryRange = "7D" | "1M" | "6M" | "1Y" | "ALL";

const RANGE_DAYS: Record<Exclude<HistoryRange, "ALL">, number> = { "7D": 7, "1M": 30, "6M": 182, "1Y": 365 };

interface Point { date: string; created: string; principal: number; rate: number }

/** Recorded snapshots if there are any, otherwise a start → last-payment approximation. */
function pointsFor(loan: Loan, snaps: LoanSnapshot[]): Point[] {
  if (snaps.length > 0) {
    return snaps
      .map((s) => ({ date: s.recorded_at, created: s.created_at, principal: s.principal, rate: s.annual_rate }))
      .sort((a, b) => (a.date === b.date ? a.created.localeCompare(b.created) : a.date.localeCompare(b.date)));
  }
  const start = (loan.start_date ?? loan.created_at).slice(0, 10);
  const last = loan.last_payment_date.slice(0, 10);
  const pts: Point[] = [];
  if (loan.initial_amount > 0 && start < last) {
    pts.push({ date: start, created: "0", principal: loan.initial_amount, rate: loan.annual_interest_rate });
  }
  pts.push({ date: last, created: "1", principal: loan.current_principal_remaining, rate: loan.annual_interest_rate });
  return pts;
}

export interface SeriesRow {
  date: string;
  label: string;
  total: number | null;
  [loanId: string]: number | string | null;
}

/** Interest cost per day (or per 30 days) for each loan and all loans combined, one row per calendar day. */
export function buildInterestSeries(
  loans: Loan[],
  snapshots: LoanSnapshot[],
  range: HistoryRange,
  metric: InterestMetric
): SeriesRow[] {
  if (loans.length === 0) return [];

  const byLoan = new Map<string, Point[]>();
  for (const l of loans) {
    byLoan.set(l.id, pointsFor(l, snapshots.filter((s) => s.loan_id === l.id)));
  }

  const today = startOfDay(new Date());
  const earliest = Array.from(byLoan.values())
    .map((pts) => pts[0]?.date)
    .filter(Boolean)
    .sort()[0];

  let start = range === "ALL" ? parseISO(earliest ?? format(today, "yyyy-MM-dd")) : addDays(today, -RANGE_DAYS[range]);
  if (range === "ALL" && differenceInCalendarDays(today, start) < 1) start = addDays(today, -1);

  const factor = metric === "MONTHLY" ? 30 : 1;
  const rows: SeriesRow[] = [];
  const days = differenceInCalendarDays(today, start);

  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i);
    const key = format(d, "yyyy-MM-dd");
    const row: SeriesRow = { date: key, label: format(d, "MMM d"), total: null };
    let total = 0;
    let any = false;

    for (const l of loans) {
      const pts = byLoan.get(l.id)!;
      let current: Point | null = null;
      for (const p of pts) {
        if (p.date <= key) current = p;
        else break;
      }
      if (!current) { row[l.id] = null; continue; }
      const value = (current.principal * (current.rate / 100)) / 365 * factor;
      row[l.id] = value;
      total += value;
      any = true;
    }
    row.total = any ? total : null;
    rows.push(row);
  }
  return rows;
}
