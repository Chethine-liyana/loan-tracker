import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import type { LoanSnapshot } from "@/types";

interface RecordArgs {
  userId: string;
  loanId: string;
  principal: number;
  rate: number;
  event: LoanSnapshot["event"];
  date?: string; // YYYY-MM-DD, defaults to today
}

/**
 * Best-effort history write. Never throws and never blocks the caller: if the
 * loan_snapshots table doesn't exist yet, the payment/edit still goes through
 * and the chart simply falls back to the loan's start and last-payment dates.
 */
export async function recordSnapshot(supabase: SupabaseClient, a: RecordArgs): Promise<void> {
  try {
    await supabase.from("loan_snapshots").insert({
      user_id: a.userId,
      loan_id: a.loanId,
      recorded_at: a.date ?? format(new Date(), "yyyy-MM-dd"),
      principal: a.principal,
      annual_rate: a.rate,
      event: a.event,
    });
  } catch {
    /* intentionally ignored */
  }
}
