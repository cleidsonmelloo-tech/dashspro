import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH /api/team/[id] — update member role
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await params
  const { role } = await request.json()

  if (!["admin", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

// DELETE /api/team/[id] — remove member
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from("workspace_members").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
