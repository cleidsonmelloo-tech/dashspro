"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function createWorkspace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  const name = (formData.get("name") as string)?.trim()
  const brandColor = (formData.get("brand_color") as string) || "#6366f1"
  const logoUrl = (formData.get("logo_url") as string)?.trim() || null

  if (!name) return { error: "Nome do workspace é obrigatório." }

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name, slug, brand_color: brandColor, logo_url: logoUrl, owner_id: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") return { error: "Já existe um workspace com esse nome." }
    return { error: "Erro ao criar workspace. Tente novamente." }
  }

  // Cria settings padrão
  await supabase.from("workspace_settings").insert({
    workspace_id: workspace.id,
    funnel_type: "ecommerce",
  })

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function updateWorkspace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!workspace) return { error: "Workspace não encontrado." }

  const name = (formData.get("name") as string)?.trim()
  const brandColor = (formData.get("brand_color") as string) || "#6366f1"
  const logoUrl = (formData.get("logo_url") as string)?.trim() || null

  const { error } = await supabase
    .from("workspaces")
    .update({ name, brand_color: brandColor, logo_url: logoUrl })
    .eq("id", workspace.id)

  if (error) return { error: "Erro ao atualizar. Tente novamente." }

  revalidatePath("/", "layout")
  return { success: "Workspace atualizado com sucesso!" }
}

export async function updateFunnelType(funnelType: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!workspace) return { error: "Workspace não encontrado." }

  await supabase
    .from("workspace_settings")
    .upsert({ workspace_id: workspace.id, funnel_type: funnelType })

  revalidatePath("/dashboard/configuracoes")
  return { success: true }
}

export async function disconnectAdAccount(accountId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  await supabase.from("ad_accounts").delete().eq("id", accountId)

  revalidatePath("/dashboard/configuracoes")
  return { success: true }
}
