import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/team — list workspace members
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspace } = await supabase
    .from("workspaces").select("id, owner_id").eq("owner_id", user.id).single()
  if (!workspace) return NextResponse.json({ members: [] })

  // Get members with their profiles
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("id, role, created_at, user_id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch profiles for each member
  const memberIds = (members ?? []).map((m) => m.user_id)
  let profiles: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[] = []

  if (memberIds.length > 0) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", memberIds)
    profiles = p ?? []
  }

  const enriched = (members ?? []).map((m) => {
    const profile = profiles.find((p) => p.id === m.user_id)
    return {
      id:         m.id,
      user_id:    m.user_id,
      role:       m.role,
      created_at: m.created_at,
      full_name:  profile?.full_name ?? null,
      email:      profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
    }
  })

  // Also include owner as a member entry
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", user.id)
    .single()

  const ownerEntry = {
    id:         "owner",
    user_id:    user.id,
    role:       "owner",
    created_at: workspace ? new Date().toISOString() : "",
    full_name:  ownerProfile?.full_name ?? null,
    email:      ownerProfile?.email ?? user.email ?? null,
    avatar_url: ownerProfile?.avatar_url ?? null,
  }

  return NextResponse.json({ members: [ownerEntry, ...enriched] })
}

// POST /api/team — invite member by email
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).single()
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const body = await request.json()
  const { email, role } = body
  if (!email) return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })

  // Look up user by email via profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Usuário não encontrado. O convidado precisa ter uma conta DashsPro." }, { status: 404 })
  }

  if (profile.id === user.id) {
    return NextResponse.json({ error: "Você já é o dono deste workspace" }, { status: 400 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", profile.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: "Usuário já é membro deste workspace" }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: profile.id, role: role ?? "viewer" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: { ...data, email: profile.email, full_name: profile.full_name } }, { status: 201 })
}
