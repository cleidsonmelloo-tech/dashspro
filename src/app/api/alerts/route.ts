import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/alerts — list alerts for current workspace
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).single()
  if (!workspace) return NextResponse.json({ alerts: [] })

  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: alerts ?? [] })
}

// POST /api/alerts — create alert
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).single()
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const body = await request.json()
  const { name, metric, operator, threshold, severity } = body

  if (!name || !metric || !operator || threshold === undefined) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("alerts")
    .insert({ workspace_id: workspace.id, name, metric, operator, threshold, severity: severity ?? "warning" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alert: data }, { status: 201 })
}
