-- ============================================================
--  Bank Liability Tracker — Supabase Schema v2
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── OPTION A: Fresh install (no existing table) ──────────────
-- Run this block if you have never created the loans table.

CREATE TABLE IF NOT EXISTS public.loans (
  id                             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name                      TEXT          NOT NULL,
  loan_type                      TEXT          NOT NULL DEFAULT 'GOLD_PAWN'
                                               CHECK (loan_type IN ('GOLD_PAWN', 'HOUSING')),
  last_payment_date              TIMESTAMPTZ   NOT NULL,
  annual_interest_rate           NUMERIC(6,2)  NOT NULL CHECK (annual_interest_rate > 0),
  current_principal_remaining    NUMERIC(15,2) NOT NULL CHECK (current_principal_remaining >= 0),
  total_historical_interest_paid NUMERIC(15,2) NOT NULL DEFAULT 0
                                               CHECK (total_historical_interest_paid >= 0),
  created_at                     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── OPTION B: Upgrade from v1 (table already exists) ─────────
-- Run these if you already have the loans table from the gold-loan build.
-- They are all safe to re-run (IF NOT EXISTS / IF EXISTS guards).

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS loan_type TEXT NOT NULL DEFAULT 'GOLD_PAWN'
    CHECK (loan_type IN ('GOLD_PAWN', 'HOUSING'));

-- Renewal / auction deadline (gold pawn tickets usually have a fixed
-- redemption period — this is the date it must be renewed or paid off by).
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS renewal_date DATE;

-- pawn_date is no longer required; make it nullable if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans' AND column_name = 'pawn_date'
  ) THEN
    ALTER TABLE public.loans ALTER COLUMN pawn_date DROP NOT NULL;
  END IF;
END $$;

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (safe re-run)
DROP POLICY IF EXISTS "Users can SELECT their own loans" ON public.loans;
DROP POLICY IF EXISTS "Users can INSERT their own loans" ON public.loans;
DROP POLICY IF EXISTS "Users can UPDATE their own loans" ON public.loans;
DROP POLICY IF EXISTS "Users can DELETE their own loans" ON public.loans;

CREATE POLICY "Users can SELECT their own loans"
  ON public.loans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT their own loans"
  ON public.loans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE their own loans"
  ON public.loans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE their own loans"
  ON public.loans FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS loans_user_id_idx      ON public.loans (user_id);
CREATE INDEX IF NOT EXISTS loans_user_type_idx    ON public.loans (user_id, loan_type);

-- ============================================================
--  Done. loans table is ready with RLS and loan_type support.
-- ============================================================
