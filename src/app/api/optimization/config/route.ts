import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const admin = createAdminClient()
  const { data } = await admin.rpc("get_optimization_config", { p_workspace_id: workspace.id })
  const config = data?.[0] || null
  return NextResponse.json({ config })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const body = await request.json()
  const admin = createAdminClient()

  // Use direct upsert instead of RPC to avoid type issues
  const { error } = await admin.from("optimization_configs").upsert({
    workspace_id:            workspace.id,
    is_enabled:              body.is_enabled ?? false,
    goal:                    body.goal ?? "leads",
    min_roas:                body.min_roas ?? 2.0,
    max_cpa:                 body.max_cpa ?? 100,
    min_ctr:                 body.min_ctr ?? 1.0,
    budget_increase_pct:     body.budget_increase_pct ?? 20,
    max_budget_per_campaign: body.max_budget_per_campaign ?? 500,
    min_days_running:        body.min_days_running ?? 3,
    auto_resume:             body.auto_resume ?? false,
    notes:                   body.notes ?? "",
    selected_account_ids:    body.selected_account_ids ?? [],
    excluded_campaign_ids:   body.excluded_campaign_ids ?? [],
    updated_at:              new Date().toISOString(),
  }, { onConflict: "workspace_id" })

  if (error) {
    console.error("[optimization/config] save error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
