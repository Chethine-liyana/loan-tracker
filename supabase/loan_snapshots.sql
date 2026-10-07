-- ============================================================
--  Loan history snapshots — powers the interest-over-time chart
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loan_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id     UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  recorded_at DATE NOT NULL,
  principal   NUMERIC(15,2) NOT NULL CHECK (principal >= 0),
  annual_rate NUMERIC(6,2)  NOT NULL,
  event       TEXT NOT NULL DEFAULT 'PAYMENT'
                CHECK (event IN ('BASELINE', 'PAYMENT', 'ADJUSTMENT')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loan_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own snapshots" ON public.loan_snapshots;
DROP POLICY IF EXISTS "insert own snapshots" ON public.loan_snapshots;
DROP POLICY IF EXISTS "delete own snapshots" ON public.loan_snapshots;
CREATE POLICY "select own snapshots" ON public.loan_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own snapshots" ON public.loan_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own snapshots" ON public.loan_snapshots FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS loan_snapshots_loan_idx ON public.loan_snapshots (loan_id, recorded_at);

-- ── Backfill: give every existing loan a starting history ─────────
-- Point 1: the original amount on the start date.
INSERT INTO public.loan_snapshots (user_id, loan_id, recorded_at, principal, annual_rate, event)
SELECT l.user_id, l.id, l.start_date::date, l.initial_amount, l.annual_interest_rate, 'BASELINE'
FROM public.loans l
WHERE l.start_date IS NOT NULL
  AND l.initial_amount > 0
  AND NOT EXISTS (SELECT 1 FROM public.loan_snapshots s WHERE s.loan_id = l.id);

-- Point 2: today's principal as of the last payment date.
INSERT INTO public.loan_snapshots (user_id, loan_id, recorded_at, principal, annual_rate, event)
SELECT l.user_id, l.id, l.last_payment_date::date, l.current_principal_remaining, l.annual_interest_rate, 'BASELINE'
FROM public.loans l
WHERE l.last_payment_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.loan_snapshots s
    WHERE s.loan_id = l.id AND s.event = 'BASELINE'
      AND s.recorded_at = l.last_payment_date::date
  );
