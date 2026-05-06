import { Sidebar } from "@/components/layout/sidebar"
import { Navbar } from "@/components/layout/navbar"
import { MainContent } from "@/components/layout/main-content"

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_project_url"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userName = "Usuário Demo"
  let userEmail = "demo@dashspro.com"
  let workspaceName = "DashsPro"
  let workspaceLogo: string | undefined
  let brandColor = "#6366f1"
  let needsOnboarding = false

  if (isSupabaseConfigured) {
    try {
      const { createClient } = await import("@/lib/supabase/server")
      const { redirect } = await import("next/navigation")
      const supabase = await createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (!user) redirect("/login")

      const [{ data: profile }, { data: wsList }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
        supabase.from("workspaces").select("*").eq("owner_id", user!.id).order("created_at", { ascending: true }),
      ])
      const workspace = (wsList as unknown[])?.[0] as { name: string; logo_url?: string; brand_color?: string } | undefined

      userName = (profile as { full_name?: string } | null)?.full_name || user!.email?.split("@")[0] || "Usuário"
      userEmail = user!.email || ""

      if (!workspace) {
        needsOnboarding = true
      } else {
        workspaceName = workspace.name
        workspaceLogo = workspace.logo_url
        brandColor = workspace.brand_color || "#6366f1"
      }
    } catch {}
  }

  if (needsOnboarding) {
    const { redirect } = await import("next/navigation")
    redirect("/onboarding")
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar workspaceName={workspaceName} workspaceLogo={workspaceLogo} brandColor={brandColor} />
      <Navbar userName={userName} userEmail={userEmail} workspaceName={workspaceName} workspaceColor={brandColor} />
      <MainContent>{children}</MainContent>
    </div>
  )
}
