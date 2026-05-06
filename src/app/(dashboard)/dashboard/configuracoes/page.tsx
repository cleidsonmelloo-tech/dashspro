"use client"

import { useState, useEffect, useTransition } from "react"
import { Search, Plus, CheckCircle2, XCircle, Loader2, Trash2, Share2, Settings, Palette, BarChart3, AlertTriangle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { updateWorkspace, updateFunnelType, disconnectAdAccount } from "@/app/actions/workspace"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"

interface AdAccount {
  id: string
  platform: "meta" | "google"
  account_id: string
  account_name: string
  is_active: boolean
  token_expires_at: string | null
  created_at: string
}

interface WorkspaceData {
  id: string
  name: string
  brand_color: string
  logo_url: string | null
}

const BRAND_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#06b6d4",
  "#3b82f6", "#64748b",
]

const FUNNEL_TYPES = [
  { key: "ecommerce", label: "E-commerce", desc: "Loja virtual — Visita → Carrinho → Compra", emoji: "🛒" },
  { key: "mensagens", label: "Mensagens", desc: "WhatsApp / DM — Clique → Conversa → Venda", emoji: "💬" },
  { key: "infoproduto", label: "Infoproduto", desc: "Curso / Digital — Lead → Checkout → Compra", emoji: "🎓" },
  { key: "cadastro", label: "Captação de Leads", desc: "Geração de leads — Clique → Form → Lead", emoji: "📋" },
  { key: "delivery", label: "Delivery / Local", desc: "Pedidos locais — Clique → Pedido → Entrega", emoji: "🍕" },
]

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<"contas" | "workspace" | "funil">("contas")
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [currentFunnel, setCurrentFunnel] = useState("ecommerce")
  const [selectedFunnel, setSelectedFunnel] = useState("ecommerce")
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [workspaceName, setWorkspaceName] = useState("")
  const [brandColor, setBrandColor] = useState("#6366f1")
  const [logoUrl, setLogoUrl] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const successParam = searchParams.get("success")
    const errorParam = searchParams.get("error")
    const metaData = searchParams.get("meta_data")
    if (metaData) {
      async function saveMetaConnection() {
        try {
          const base64 = metaData!.replace(/-/g, "+").replace(/_/g, "/")
          const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=")
          const payload = JSON.parse(atob(padded))
          const supabase = createClient()
          for (const item of payload) {
            const { error } = await supabase.rpc("upsert_ad_account", {
              p_workspace_id: item.workspace_id,
              p_platform: item.platform,
              p_account_id: item.account_id,
              p_account_name: item.account_name,
              p_access_token: item.access_token,
              p_token_expires_at: item.token_expires_at,
              p_is_active: item.is_active,
            })
            if (error) throw error
          }
          // Reload accounts immediately after save
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: ws } = await supabase
              .from("workspaces")
              .select("id")
              .eq("owner_id", session.user.id)
              .single()
            if (ws) {
              const { data: accs } = await supabase
                .from("ad_accounts")
                .select("id, platform, account_id, account_name, is_active, token_expires_at, created_at")
                .eq("workspace_id", ws.id)
                .order("created_at", { ascending: false })
              setAccounts(accs || [])
            }
          }
          setFeedback({ type: "success", msg: "Meta Ads conectado com sucesso!" })
          setTimeout(() => setFeedback(null), 5000)
        } catch (err: unknown) {
          const msg = err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err)
          setFeedback({ type: "error", msg: `Erro Meta: ${msg}` })
          setTimeout(() => setFeedback(null), 10000)
        }
      }
      saveMetaConnection()
    }

    if (successParam === "meta_connected") setFeedback({ type: "success", msg: "Meta Ads conectado com sucesso!" })
    if (successParam === "google_connected") setFeedback({ type: "success", msg: "Google Ads conectado com sucesso!" })
    if (errorParam === "meta_denied") setFeedback({ type: "error", msg: "Autorização Meta cancelada." })
    if (errorParam === "google_denied") setFeedback({ type: "error", msg: "Autorização Google cancelada." })
    if (errorParam === "meta_token") setFeedback({ type: "error", msg: "Erro ao obter token Meta. Tente novamente." })
    if (errorParam === "google_token") setFeedback({ type: "error", msg: "Erro ao obter token Google. Tente novamente." })
    if (successParam || errorParam) {
      setTimeout(() => setFeedback(null), 5000)
    }
  }, [searchParams])

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, brand_color, logo_url")
        .eq("owner_id", user.id)
        .single()

      if (ws) {
        setWorkspace(ws)
        setWorkspaceName(ws.name)
        setBrandColor(ws.brand_color || "#6366f1")
        setLogoUrl(ws.logo_url || "")

        const { data: accs } = await supabase
          .from("ad_accounts")
          .select("id, platform, account_id, account_name, is_active, token_expires_at, created_at")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false })

        setAccounts(accs || [])

        const { data: settings } = await supabase
          .from("workspace_settings")
          .select("funnel_type")
          .eq("workspace_id", ws.id)
          .single()

        if (settings?.funnel_type) {
          setCurrentFunnel(settings.funnel_type)
          setSelectedFunnel(settings.funnel_type)
        }
      }
      setLoadingAccounts(false)
    }
    loadData()
  }, [feedback])

  function handleDisconnect(id: string) {
    startTransition(async () => {
      await disconnectAdAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    })
  }

  function handleSaveWorkspace() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("name", workspaceName)
      fd.append("brand_color", brandColor)
      fd.append("logo_url", logoUrl)
      const result = await updateWorkspace(fd)
      if (result?.error) setFeedback({ type: "error", msg: result.error })
      else setFeedback({ type: "success", msg: "Workspace atualizado com sucesso!" })
    })
  }

  function handleSaveFunnel() {
    startTransition(async () => {
      const result = await updateFunnelType(selectedFunnel)
      if (result?.error) setFeedback({ type: "error", msg: result.error })
      else {
        setCurrentFunnel(selectedFunnel)
        setFeedback({ type: "success", msg: "Funil padrão atualizado!" })
      }
    })
  }

  const metaAccounts = accounts.filter((a) => a.platform === "meta")
  const googleAccounts = accounts.filter((a) => a.platform === "google")

  function isTokenExpired(expiresAt: string | null) {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-[#71717a] mt-0.5">Gerencie sua conta, integrações e preferências</p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
          feedback.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        )}>
          {feedback.type === "success"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#111118] border border-[var(--border)] rounded-xl w-fit">
        {[
          { key: "contas", label: "Contas de Anúncios" },
          { key: "workspace", label: "Workspace" },
          { key: "funil", label: "Funil Padrão" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === tab.key
                ? "bg-[#6366f1] text-white"
                : "text-[#71717a] hover:text-[#f4f4f5]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Contas de Anúncios */}
      {activeTab === "contas" && (
        <div className="flex flex-col gap-4">
          {/* Meta Ads */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Meta Ads</CardTitle>
                    <CardDescription>Conecte contas do Facebook e Instagram Ads</CardDescription>
                  </div>
                </div>
                <a href="/api/auth/meta">
                  <Button size="sm" className="gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Conectar conta
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[#71717a]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando contas...</span>
                </div>
              ) : metaAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-sm text-[#71717a]">Nenhuma conta Meta conectada ainda.</p>
                  <p className="text-xs text-[#52525b] mt-1">Clique em "Conectar conta" para adicionar suas contas.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {metaAccounts.map((acc) => {
                    const expired = isTokenExpired(acc.token_expires_at)
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0d0d14] border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", expired ? "bg-amber-400" : "bg-emerald-400")} />
                          <div>
                            <p className="text-sm font-medium text-white">{acc.account_name}</p>
                            <p className="text-xs text-[#52525b]">ID: {acc.account_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expired && (
                            <Badge className="text-amber-400 border-amber-400/30 bg-amber-400/10 text-xs">Token expirado</Badge>
                          )}
                          <Badge className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">Ativo</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2"
                            onClick={() => handleDisconnect(acc.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Ads */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle>Google Ads</CardTitle>
                    <CardDescription>Conecte contas do Google Ads e campanhas Search</CardDescription>
                  </div>
                </div>
                <a href="/api/auth/google">
                  <Button size="sm" className="gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Conectar conta
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[#71717a]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando contas...</span>
                </div>
              ) : googleAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-sm text-[#71717a]">Nenhuma conta Google conectada ainda.</p>
                  <p className="text-xs text-[#52525b] mt-1">Clique em "Conectar conta" para adicionar suas contas.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {googleAccounts.map((acc) => {
                    const expired = isTokenExpired(acc.token_expires_at)
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0d0d14] border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", expired ? "bg-amber-400" : "bg-emerald-400")} />
                          <div>
                            <p className="text-sm font-medium text-white">{acc.account_name}</p>
                            <p className="text-xs text-[#52525b]">ID: {acc.account_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expired && (
                            <Badge className="text-amber-400 border-amber-400/30 bg-amber-400/10 text-xs">Token expirado</Badge>
                          )}
                          <Badge className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">Ativo</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2"
                            onClick={() => handleDisconnect(acc.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Workspace */}
      {activeTab === "workspace" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#6366f1]" />
              <div>
                <CardTitle>Personalização do Workspace</CardTitle>
                <CardDescription>Configure o nome, logo e cor da sua marca</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Input
              label="Nome do workspace"
              placeholder="Ex: Agência XYZ"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#a1a1aa] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#6366f1]" />
                Cor da marca
              </label>
              <div className="flex flex-wrap gap-2.5 mb-2">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrandColor(c)}
                    className={cn(
                      "w-8 h-8 rounded-lg cursor-pointer transition-all border-2",
                      brandColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-2 border-[var(--border)] bg-transparent p-0.5"
                  title="Cor personalizada"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg border-2 border-white/20" style={{ backgroundColor: brandColor }} />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-36 font-mono text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a1a1aa]">Logo (URL)</label>
              <Input
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveWorkspace} loading={isPending} className="w-fit">
              Salvar alterações
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tab: Funil */}
      {activeTab === "funil" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#6366f1]" />
              <div>
                <CardTitle>Tipo de Funil Padrão</CardTitle>
                <CardDescription>Escolha o modelo que melhor representa seu negócio</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FUNNEL_TYPES.map((funnel) => (
                <button
                  key={funnel.key}
                  onClick={() => setSelectedFunnel(funnel.key)}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer",
                    selectedFunnel === funnel.key
                      ? "border-[#6366f1] bg-[#6366f1]/10"
                      : "border-[var(--border)] bg-[#0d0d14] hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5"
                  )}
                >
                  <span className="text-2xl">{funnel.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{funnel.label}</p>
                    <p className="text-xs text-[#71717a] mt-0.5">{funnel.desc}</p>
                  </div>
                  {selectedFunnel === funnel.key && (
                    <CheckCircle2 className="w-4 h-4 text-[#6366f1] flex-shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
            {selectedFunnel !== currentFunnel && (
              <p className="text-xs text-amber-400 mt-3">Você alterou o funil — salve para aplicar.</p>
            )}
            <Button onClick={handleSaveFunnel} loading={isPending} className="mt-5">
              Salvar preferência
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
