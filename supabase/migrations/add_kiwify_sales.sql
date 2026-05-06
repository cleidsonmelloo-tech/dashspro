-- =====================================================
-- Migration: Kiwify sales events table
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kiwify_sales (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  order_id        text        NOT NULL,
  event_type      text        NOT NULL DEFAULT 'order.approved',
  product_name    text,
  product_id      text,
  amount          numeric     NOT NULL DEFAULT 0,
  commission      numeric     DEFAULT 0,
  status          text        NOT NULL DEFAULT 'paid',
  payment_method  text,
  customer_name   text,
  customer_email  text,
  raw_payload     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, order_id)
);

ALTER TABLE public.kiwify_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kiwify sales" ON public.kiwify_sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id = workspace_id
        AND (w.owner_id = auth.uid() OR wm.user_id = auth.uid())
    )
  );

-- RPC to get Kiwify stats for a date range (SECURITY DEFINER bypasses RLS for server-side)
CREATE OR REPLACE FUNCTION public.get_kiwify_stats(
  p_workspace_id uuid,
  p_since        date,
  p_until        date
)
RETURNS TABLE (
  total_sales    bigint,
  total_revenue  numeric,
  avg_ticket     numeric,
  refunds        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'paid')         AS total_sales,
    COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS total_revenue,
    CASE WHEN COUNT(*) FILTER (WHERE status = 'paid') > 0
         THEN SUM(amount) FILTER (WHERE status = 'paid') /
              COUNT(*) FILTER (WHERE status = 'paid')
         ELSE 0 END                                  AS avg_ticket,
    COUNT(*) FILTER (WHERE status = 'refunded')     AS refunds
  FROM public.kiwify_sales
  WHERE workspace_id = p_workspace_id
    AND created_at::date BETWEEN p_since AND p_until;
END;
$$;
