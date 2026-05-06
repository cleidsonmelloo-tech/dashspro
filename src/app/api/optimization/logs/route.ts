import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "100")

  const { data, error } = await supabase.rpc("get_optimization_logs", {
    p_workspace_id: workspace.id,
    p_limit: limit,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}
