import { Sidebar } from "@/components/layout/sidebar"
import { Navbar } from "@/components/layout/navbar"
import { MainContent } from "@/components/layout/main-content"
import { FilterProvider } from "@/lib/filter-context"

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_project_url"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userName = "Usuário Demo"
  let userEmail = "demo@dashspro.com"
  let userAvatar: string | undefined
  let workspaceName = "DashsPro"
  let workspaceLogo: string | undefined
  let brandColor = "#FF5F1A"
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
      const prof = profile as { full_name?: string; avatar_url?: string } | null

      userName = prof?.full_name || user!.email?.split("@")[0] || "Usuário"
      userEmail = user!.email || ""
      userAvatar = prof?.avatar_url

      if (!workspace) {
        needsOnboarding = true
      } else {
        workspaceName = workspace.name
        workspaceLogo = workspace.logo_url
        brandColor = workspace.brand_color || "#FF5F1A"
      }
    } catch {}
  }

  if (needsOnboarding) {
    const { redirect } = await import("next/navigation")
    redirect("/onboarding")
  }

  return (
    <FilterProvider>
      <div className="min-h-screen bg-[#0a0a0a]">
        <Sidebar workspaceName={workspaceName} workspaceLogo={workspaceLogo || userAvatar} brandColor={brandColor} />
        <Navbar userName={userName} userEmail={userEmail} userAvatar={userAvatar} workspaceName={workspaceName} workspaceColor={brandColor} />
        <MainContent>{children}</MainContent>
      </div>
    </FilterProvider>
  )
}
