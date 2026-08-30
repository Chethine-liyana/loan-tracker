-- ============================================================
--  Budget / Expense Tracker — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Uses the same auth.users / RLS pattern as the loans table.
-- ============================================================

-- ── Profile (per-user settings) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Accounts (cash / bank / card / savings / other) ─────────────
CREATE TABLE IF NOT EXISTS public.fin_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'cash'
                     CHECK (type IN ('cash', 'bank', 'card', 'savings', 'other')),
  icon             TEXT NOT NULL DEFAULT 'wallet',
  color            TEXT NOT NULL DEFAULT '#6366f1',
  starting_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'USD',
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Categories ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'shapes',
  color      TEXT NOT NULL DEFAULT '#6366f1',
  kind       TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Transactions (expense / income / transfer) ───────────────────
CREATE TABLE IF NOT EXISTS public.fin_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES public.fin_accounts(id) ON DELETE CASCADE,
  to_account_id UUID REFERENCES public.fin_accounts(id) ON DELETE SET NULL,
  category_id   UUID REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date          DATE NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Budgets (per category, per month) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.fin_categories(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  month       INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  recurring   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, month, year)
);

-- Upgrade (safe to re-run): add the recurring flag if this table already existed
ALTER TABLE public.fin_budgets ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Recurring transactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_recurring (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES public.fin_accounts(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note          TEXT,
  frequency     TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  next_run_date DATE NOT NULL,
  end_date      DATE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.fin_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_budgets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_recurring   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_accounts', 'fin_categories', 'fin_transactions', 'fin_budgets', 'fin_recurring'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "select own" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "insert own" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update own" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "delete own" ON public.%I', t);
    EXECUTE format('CREATE POLICY "select own" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "insert own" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "update own" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "delete own" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "select own profile" ON public.fin_profiles;
DROP POLICY IF EXISTS "insert own profile" ON public.fin_profiles;
DROP POLICY IF EXISTS "update own profile" ON public.fin_profiles;
CREATE POLICY "select own profile" ON public.fin_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own profile" ON public.fin_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own profile" ON public.fin_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS fin_accounts_user_idx      ON public.fin_accounts (user_id);
CREATE INDEX IF NOT EXISTS fin_categories_user_idx    ON public.fin_categories (user_id);
CREATE INDEX IF NOT EXISTS fin_transactions_user_date_idx ON public.fin_transactions (user_id, date);
CREATE INDEX IF NOT EXISTS fin_transactions_account_idx   ON public.fin_transactions (account_id);
CREATE INDEX IF NOT EXISTS fin_transactions_category_idx  ON public.fin_transactions (category_id);
CREATE INDEX IF NOT EXISTS fin_budgets_user_period_idx ON public.fin_budgets (user_id, year, month);
CREATE INDEX IF NOT EXISTS fin_recurring_user_idx      ON public.fin_recurring (user_id);
CREATE INDEX IF NOT EXISTS fin_recurring_next_run_idx  ON public.fin_recurring (next_run_date);

-- ============================================================
--  Done. Budget tracker tables are ready with RLS.
-- ============================================================
