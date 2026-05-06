import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data } = await supabase.rpc("get_optimization_config", { p_workspace_id: workspace.id })
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
  const { error } = await supabase.rpc("upsert_optimization_config", {
    p_workspace_id: workspace.id,
    p_is_enabled: body.is_enabled ?? false,
    p_goal: body.goal ?? "leads",
    p_min_roas: body.min_roas ?? 2.0,
    p_max_cpa: body.max_cpa ?? 100,
    p_min_ctr: body.min_ctr ?? 1.0,
    p_budget_increase_pct: body.budget_increase_pct ?? 20,
    p_max_budget_per_campaign: body.max_budget_per_campaign ?? 500,
    p_min_days_running: body.min_days_running ?? 3,
    p_auto_resume: body.auto_resume ?? false,
    p_notes: body.notes ?? "",
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
