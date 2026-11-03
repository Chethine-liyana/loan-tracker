-- Bank details (yours and friends') for the Banks tab
-- Run in: Supabase Dashboard → SQL Editor → New Query (safe to re-run)

CREATE TABLE IF NOT EXISTS public.bank_contacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname   TEXT,
  name       TEXT        NOT NULL,
  bank       TEXT        NOT NULL,
  branch     TEXT,
  account_no TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bank_contacts_user_idx ON public.bank_contacts (user_id);

ALTER TABLE public.bank_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bank contacts" ON public.bank_contacts;
CREATE POLICY "Users manage own bank contacts"
  ON public.bank_contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
