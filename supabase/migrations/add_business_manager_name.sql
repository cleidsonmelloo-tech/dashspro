-- =====================================================
-- Migration: Add business_manager_name to ad_accounts
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add column
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS business_manager_name TEXT DEFAULT NULL;

-- 2. Replace upsert_ad_account — now accepts optional p_business_manager_name
CREATE OR REPLACE FUNCTION public.upsert_ad_account(
  p_workspace_id          UUID,
  p_platform              TEXT,
  p_account_id            TEXT,
  p_account_name          TEXT,
  p_access_token          TEXT,
  p_token_expires_at      TIMESTAMPTZ,
  p_is_active             BOOLEAN,
  p_business_manager_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ad_accounts (
    workspace_id, platform, account_id, account_name,
    access_token, token_expires_at, is_active,
    business_manager_name, updated_at
  )
  VALUES (
    p_workspace_id, p_platform, p_account_id, p_account_name,
    p_access_token, p_token_expires_at, p_is_active,
    p_business_manager_name, now()
  )
  ON CONFLICT (workspace_id, platform, account_id)
  DO UPDATE SET
    account_name          = EXCLUDED.account_name,
    access_token          = EXCLUDED.access_token,
    token_expires_at      = EXCLUDED.token_expires_at,
    is_active             = EXCLUDED.is_active,
    business_manager_name = EXCLUDED.business_manager_name,
    updated_at            = now();
END;
$$;

-- 3. Replace get_workspace_ad_accounts — now returns business_manager_name
CREATE OR REPLACE FUNCTION public.get_workspace_ad_accounts(
  p_workspace_id UUID
)
RETURNS TABLE (
  id                    UUID,
  workspace_id          UUID,
  platform              TEXT,
  account_id            TEXT,
  account_name          TEXT,
  access_token          TEXT,
  token_expires_at      TIMESTAMPTZ,
  is_active             BOOLEAN,
  business_manager_name TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aa.id,
    aa.workspace_id,
    aa.platform,
    aa.account_id,
    aa.account_name,
    aa.access_token,
    aa.token_expires_at,
    aa.is_active,
    aa.business_manager_name,
    aa.created_at,
    aa.updated_at
  FROM public.ad_accounts aa
  WHERE aa.workspace_id = p_workspace_id;
END;
$$;
