-- =====================================================
-- Migration: Piloto Automático (Optimization Engine)
-- Run this in Supabase SQL Editor
-- =====================================================

-- ── 1. optimization_configs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.optimization_configs (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id            uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_enabled              boolean     NOT NULL DEFAULT false,
  goal                    text        NOT NULL DEFAULT 'leads',
  min_roas                numeric     NOT NULL DEFAULT 2.0,
  max_cpa                 numeric     NOT NULL DEFAULT 100,
  min_ctr                 numeric     NOT NULL DEFAULT 1.0,
  budget_increase_pct     numeric     NOT NULL DEFAULT 20,
  max_budget_per_campaign numeric     NOT NULL DEFAULT 500,
  min_days_running        integer     NOT NULL DEFAULT 3,
  auto_resume             boolean     NOT NULL DEFAULT false,
  notes                   text        NOT NULL DEFAULT '',
  selected_account_ids    jsonb       NOT NULL DEFAULT '[]',
  excluded_campaign_ids   jsonb       NOT NULL DEFAULT '[]',
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.optimization_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage optimization config" ON public.optimization_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

-- ── 2. optimization_logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.optimization_logs (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id    text        NOT NULL,
  campaign_name  text        NOT NULL,
  platform       text        NOT NULL DEFAULT 'meta',
  account_name   text        NOT NULL DEFAULT '',
  action         text        NOT NULL DEFAULT 'no_action',
  reason         text        NOT NULL DEFAULT '',
  reasoning      text        NOT NULL DEFAULT '',
  old_value      jsonb,
  new_value      jsonb,
  executed       boolean     NOT NULL DEFAULT false,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.optimization_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view optimization logs" ON public.optimization_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_opt_logs_workspace_created
  ON public.optimization_logs(workspace_id, created_at DESC);

-- ── 3. optimization_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.optimization_reports (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_date         date        NOT NULL,
  summary             text        NOT NULL DEFAULT '',
  actions_count       integer     NOT NULL DEFAULT 0,
  campaigns_paused    integer     NOT NULL DEFAULT 0,
  campaigns_resumed   integer     NOT NULL DEFAULT 0,
  budgets_increased   integer     NOT NULL DEFAULT 0,
  highlights          jsonb       NOT NULL DEFAULT '[]',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, report_date)
);

ALTER TABLE public.optimization_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view optimization reports" ON public.optimization_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

-- ── 4. RPCs ───────────────────────────────────────────────────────────────────

-- get_optimization_config
CREATE OR REPLACE FUNCTION public.get_optimization_config(p_workspace_id uuid)
RETURNS TABLE (
  is_enabled              boolean,
  goal                    text,
  min_roas                numeric,
  max_cpa                 numeric,
  min_ctr                 numeric,
  budget_increase_pct     numeric,
  max_budget_per_campaign numeric,
  min_days_running        integer,
  auto_resume             boolean,
  notes                   text,
  selected_account_ids    jsonb,
  excluded_campaign_ids   jsonb
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT c.is_enabled, c.goal, c.min_roas, c.max_cpa, c.min_ctr,
         c.budget_increase_pct, c.max_budget_per_campaign, c.min_days_running,
         c.auto_resume, c.notes, c.selected_account_ids, c.excluded_campaign_ids
  FROM public.optimization_configs c
  WHERE c.workspace_id = p_workspace_id;
END;
$$;

-- upsert_optimization_config
CREATE OR REPLACE FUNCTION public.upsert_optimization_config(
  p_workspace_id            uuid,
  p_is_enabled              boolean,
  p_goal                    text,
  p_min_roas                numeric,
  p_max_cpa                 numeric,
  p_min_ctr                 numeric,
  p_budget_increase_pct     numeric,
  p_max_budget_per_campaign numeric,
  p_min_days_running        integer,
  p_auto_resume             boolean,
  p_notes                   text,
  p_selected_account_ids    jsonb,
  p_excluded_campaign_ids   jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.optimization_configs (
    workspace_id, is_enabled, goal, min_roas, max_cpa, min_ctr,
    budget_increase_pct, max_budget_per_campaign, min_days_running,
    auto_resume, notes, selected_account_ids, excluded_campaign_ids, updated_at
  ) VALUES (
    p_workspace_id, p_is_enabled, p_goal, p_min_roas, p_max_cpa, p_min_ctr,
    p_budget_increase_pct, p_max_budget_per_campaign, p_min_days_running,
    p_auto_resume, p_notes, p_selected_account_ids, p_excluded_campaign_ids, now()
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    is_enabled              = EXCLUDED.is_enabled,
    goal                    = EXCLUDED.goal,
    min_roas                = EXCLUDED.min_roas,
    max_cpa                 = EXCLUDED.max_cpa,
    min_ctr                 = EXCLUDED.min_ctr,
    budget_increase_pct     = EXCLUDED.budget_increase_pct,
    max_budget_per_campaign = EXCLUDED.max_budget_per_campaign,
    min_days_running        = EXCLUDED.min_days_running,
    auto_resume             = EXCLUDED.auto_resume,
    notes                   = EXCLUDED.notes,
    selected_account_ids    = EXCLUDED.selected_account_ids,
    excluded_campaign_ids   = EXCLUDED.excluded_campaign_ids,
    updated_at              = now();
END;
$$;

-- insert_optimization_log
CREATE OR REPLACE FUNCTION public.insert_optimization_log(
  p_workspace_id  uuid,
  p_campaign_id   text,
  p_campaign_name text,
  p_platform      text,
  p_account_name  text,
  p_action        text,
  p_reason        text,
  p_reasoning     text,
  p_old_value     text,
  p_new_value     text,
  p_executed      boolean,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.optimization_logs (
    workspace_id, campaign_id, campaign_name, platform, account_name,
    action, reason, reasoning,
    old_value, new_value, executed, error_message
  ) VALUES (
    p_workspace_id, p_campaign_id, p_campaign_name, p_platform, p_account_name,
    p_action, p_reason, p_reasoning,
    CASE WHEN p_old_value IS NOT NULL THEN p_old_value::jsonb ELSE NULL END,
    CASE WHEN p_new_value IS NOT NULL THEN p_new_value::jsonb ELSE NULL END,
    p_executed, p_error_message
  );
END;
$$;

-- get_optimization_logs
CREATE OR REPLACE FUNCTION public.get_optimization_logs(
  p_workspace_id uuid,
  p_limit        integer DEFAULT 200
)
RETURNS TABLE (
  id            uuid,
  campaign_id   text,
  campaign_name text,
  platform      text,
  account_name  text,
  action        text,
  reason        text,
  reasoning     text,
  old_value     jsonb,
  new_value     jsonb,
  executed      boolean,
  error_message text,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.campaign_id, l.campaign_name, l.platform, l.account_name,
         l.action, l.reason, l.reasoning, l.old_value, l.new_value,
         l.executed, l.error_message, l.created_at
  FROM public.optimization_logs l
  WHERE l.workspace_id = p_workspace_id
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

-- upsert_optimization_report
CREATE OR REPLACE FUNCTION public.upsert_optimization_report(
  p_workspace_id     uuid,
  p_report_date      date,
  p_summary          text,
  p_actions_count    integer,
  p_campaigns_paused integer,
  p_campaigns_resumed integer,
  p_budgets_increased integer,
  p_highlights       text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.optimization_reports (
    workspace_id, report_date, summary, actions_count,
    campaigns_paused, campaigns_resumed, budgets_increased, highlights
  ) VALUES (
    p_workspace_id, p_report_date, p_summary, p_actions_count,
    p_campaigns_paused, p_campaigns_resumed, p_budgets_increased,
    COALESCE(p_highlights::jsonb, '[]'::jsonb)
  )
  ON CONFLICT (workspace_id, report_date) DO UPDATE SET
    summary             = EXCLUDED.summary,
    actions_count       = optimization_reports.actions_count + EXCLUDED.actions_count,
    campaigns_paused    = optimization_reports.campaigns_paused + EXCLUDED.campaigns_paused,
    campaigns_resumed   = optimization_reports.campaigns_resumed + EXCLUDED.campaigns_resumed,
    budgets_increased   = optimization_reports.budgets_increased + EXCLUDED.budgets_increased,
    highlights          = EXCLUDED.highlights;
END;
$$;

-- get_optimization_report
CREATE OR REPLACE FUNCTION public.get_optimization_report(
  p_workspace_id uuid,
  p_date         date
)
RETURNS TABLE (
  report_date         date,
  summary             text,
  actions_count       integer,
  campaigns_paused    integer,
  campaigns_resumed   integer,
  budgets_increased   integer,
  highlights          jsonb,
  created_at          timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT r.report_date, r.summary, r.actions_count,
         r.campaigns_paused, r.campaigns_resumed, r.budgets_increased,
         r.highlights, r.created_at
  FROM public.optimization_reports r
  WHERE r.workspace_id = p_workspace_id
    AND r.report_date = p_date;
END;
$$;
