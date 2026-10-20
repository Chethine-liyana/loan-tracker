import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { DateRange } from "@/types/budget";

/**
 * A "month" in the budget tracker runs from `startDay` of the previous
 * calendar month to the day before `startDay` of this one (e.g. startDay 25:
 * 25 Sep → 24 Oct). It is named after the month it ENDS in ("October"), so
 * the salary that arrives on 25 Sep funds October. startDay 1 = calendar month.
 */
export interface Period { month: number; year: number }

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function clampStartDay(day: number | null | undefined): number {
  const n = Math.floor(Number(day));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : 1;
}

export function periodRange(month: number, year: number, startDay = 1): DateRange {
  if (startDay <= 1) {
    return { from: ymd(new Date(year, month - 1, 1)), to: ymd(new Date(year, month, 0)) };
  }
  return { from: ymd(new Date(year, month - 2, startDay)), to: ymd(new Date(year, month - 1, startDay - 1)) };
}

/** Which named period a YYYY-MM-DD date (or Date) falls in. */
export function periodOf(date: string | Date, startDay = 1): Period {
  const [y, m, d] =
    typeof date === "string"
      ? date.slice(0, 10).split("-").map(Number)
      : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  if (startDay > 1 && d >= startDay) {
    return m === 12 ? { month: 1, year: y + 1 } : { month: m + 1, year: y };
  }
  return { month: m, year: y };
}

export const currentPeriod = (startDay = 1): Period => periodOf(new Date(), startDay);

export function periodKey(date: string | Date, startDay = 1): string {
  const p = periodOf(date, startDay);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function shiftPeriod(p: Period, delta: number): Period {
  const d = addMonths(new Date(p.year, p.month - 1, 1), delta);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Number of days in the period. */
export function periodDays(month: number, year: number, startDay = 1): number {
  const r = periodRange(month, year, startDay);
  return differenceInCalendarDays(parseISO(r.to), parseISO(r.from)) + 1;
}

/** "25 Sep – 24 Oct" (empty for calendar months, where the name says it all). */
export function periodSpanText(month: number, year: number, startDay = 1): string {
  if (startDay <= 1) return "";
  const r = periodRange(month, year, startDay);
  return `${format(parseISO(r.from), "d MMM")} – ${format(parseISO(r.to), "d MMM")}`;
}
