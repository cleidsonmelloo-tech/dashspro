import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

// ─── Types ───────────────────────────────────────────────────────────────────
interface OptConfig {
  is_enabled: boolean; goal: string; min_roas: number; max_cpa: number
  min_ctr: number; budget_increase_pct: number; max_budget_per_campaign: number
  min_days_running: number; auto_resume: boolean; notes: string
  selected_account_ids: string[]; excluded_campaign_ids: string[]
}
interface MetaAccount { account_id: string; account_name: string; access_token: string; token_expires_at: string | null }
interface AIDecision {
  campaign_id: string; campaign_name: string
  action: "pause" | "resume" | "increase_budget" | "decrease_budget" | "no_action"
  reason: string; reasoning: string; new_budget_brl: number | null
}
interface CampaignData {
  meta_campaign_id: string; account_id: string; account_name: string
  name: string; status: string; daily_budget_brl: number | null
  spend_7d: number; roas_7d: number; cpa_7d: number; ctr_7d: number
  clicks_7d: number; conversions_7d: number; impressions_7d: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDate(daysAgo: number) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split("T")[0]
}

async function metaApiAction(
  campaignId: string, action: string, accessToken: string, newBudgetCents?: number
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { access_token: accessToken }
  if (action === "pause") body.status = "PAUSED"
  else if (action === "resume") body.status = "ACTIVE"
  else if (action === "increase_budget" || action === "decrease_budget") {
    if (!newBudgetCents) return { ok: false, error: "Orçamento não informado" }
    body.daily_budget = newBudgetCents
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: err?.error?.message || "Erro na API do Meta" }
  }
  return { ok: true }
}

async function fetchCampaignData(accounts: MetaAccount[]): Promise<CampaignData[]> {
  const since = getDate(7)
  const until = getDate(0)
  const insightFields = "spend,impressions,clicks,actions,action_values,purchase_roas,cpc,ctr"
  const fields = `name,status,effective_status,daily_budget,insights.time_range({"since":"${since}","until":"${until}"}){${insightFields}}`
  const allCampaigns: CampaignData[] = []

  for (const account of accounts) {
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) continue
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/campaigns?` +
      new URLSearchParams({
        fields, limit: "500",
        filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
        access_token: account.access_token,
      })
    )
    if (!res.ok) continue
    const data = await res.json()
    for (const c of (data.data || [])) {
      const insight = c.insights?.data?.[0]
      const spend = parseFloat(insight?.spend || "0")
      const impressions = parseInt(insight?.impressions || "0")
      const clicks = parseInt(insight?.clicks || "0")
      const actions = insight?.actions || []
      const convAction = actions.find((a: { action_type: string; value: string }) =>
        ["purchase", "lead", "complete_registration", "omni_purchase"].includes(a.action_type)
      )
      const conversions = convAction ? parseFloat(convAction.value || "0") : 0
      const purchaseRoas = (insight?.purchase_roas || []).find((r: { action_type: string; value: string }) =>
        ["omni_purchase", "purchase"].includes(r.action_type)
      )
      const purchaseValue = (insight?.action_values || []).reduce((s: number, av: { action_type: string; value: string }) =>
        ["omni_purchase", "purchase"].includes(av.action_type) ? s + parseFloat(av.value || "0") : s, 0
      )
      const roas = purchaseRoas ? parseFloat(purchaseRoas.value || "0") : (spend > 0 && purchaseValue > 0 ? purchaseValue / spend : 0)
      const cpa = conversions > 0 ? spend / conversions : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : parseFloat(insight?.ctr || "0")
      allCampaigns.push({
        meta_campaign_id: c.id,
        account_id: account.account_id,
        account_name: account.account_name,
        name: c.name,
        status: (c.effective_status || c.status || "ACTIVE").toUpperCase(),
        daily_budget_brl: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
        spend_7d: spend, roas_7d: roas, cpa_7d: cpa, ctr_7d: ctr,
        clicks_7d: clicks, conversions_7d: conversions, impressions_7d: impressions,
      })
    }
  }
  return allCampaigns
}

async function askAI(campaigns: CampaignData[], config: OptConfig): Promise<AIDecision[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback: rule-based decisions without AI
    return campaigns.map(c => {
      if (c.status === "ACTIVE" && c.spend_7d > 50) {
        if (config.min_roas > 0 && c.roas_7d > 0 && c.roas_7d < config.min_roas) {
          return { campaign_id: c.meta_campaign_id, campaign_name: c.name, action: "pause", reason: `ROAS ${c.roas_7d.toFixed(1)}x abaixo do mínimo ${config.min_roas}x`, reasoning: "Regra automática: ROAS insuficiente.", new_budget_brl: null }
        }
        if (config.max_cpa > 0 && c.cpa_7d > config.max_cpa) {
          return { campaign_id: c.meta_campaign_id, campaign_name: c.name, action: "pause", reason: `CPA R$${c.cpa_7d.toFixed(0)} acima do máximo R$${config.max_cpa}`, reasoning: "Regra automática: CPA acima do limite.", new_budget_brl: null }
        }
        if (c.roas_7d >= config.min_roas * 1.5 && c.daily_budget_brl && c.daily_budget_brl < config.max_budget_per_campaign) {
          const newBudget = Math.min(c.daily_budget_brl * (1 + config.budget_increase_pct / 100), config.max_budget_per_campaign)
          return { campaign_id: c.meta_campaign_id, campaign_name: c.name, action: "increase_budget", reason: `ROAS excelente ${c.roas_7d.toFixed(1)}x — escalando orçamento`, reasoning: "Regra automática: performance excelente.", new_budget_brl: newBudget }
        }
      }
      return { campaign_id: c.meta_campaign_id, campaign_name: c.name, action: "no_action", reason: "Performance dentro dos parâmetros", reasoning: "Nenhuma ação necessária.", new_budget_brl: null }
    })
  }

  const client = new Anthropic({ apiKey })
  const systemPrompt = `Você é o Piloto Automático — agente de IA especialista em otimização de campanhas de tráfego pago (Meta Ads). Seu objetivo é maximizar geração de leads qualificados e ROAS.

RETORNE APENAS um array JSON válido, sem texto adicional, sem markdown, sem blocos de código.

Configurações do cliente:
- Objetivo principal: ${config.goal === "leads" ? "Geração de Leads" : config.goal === "purchases" ? "Vendas/Compras" : "ROAS máximo"}
- ROAS mínimo aceitável: ${config.min_roas}x
- CPA máximo permitido: R$${config.max_cpa}
- CTR mínimo esperado: ${config.min_ctr}%
- Aumento máximo de orçamento por ciclo: ${config.budget_increase_pct}%
- Orçamento máximo por campanha/dia: R$${config.max_budget_per_campaign}
- Mínimo de dias rodando antes de pausar: ${config.min_days_running}
${config.notes ? `- Instruções adicionais do cliente: ${config.notes}` : ""}

Regras de decisão:
1. Pausar campanha ATIVA se ROAS < ${config.min_roas}x E gasto > R$50 nos últimos 7 dias
2. Pausar campanha ATIVA se CPA > R$${config.max_cpa} E conversões > 3
3. Aumentar orçamento se ROAS > ${(config.min_roas * 1.5).toFixed(1)}x E orçamento atual < R$${config.max_budget_per_campaign}
4. Retomar campanha PAUSADA apenas se config auto_resume = true e houver indicativo de melhora (analyze context)
5. Ser conservador — quando em dúvida, usar "no_action"
6. NUNCA exceder R$${config.max_budget_per_campaign}/dia por campanha

Formato de saída OBRIGATÓRIO (array JSON puro):
[{"campaign_id":"...","campaign_name":"...","action":"pause|resume|increase_budget|decrease_budget|no_action","reason":"Motivo curto em português (máx 80 chars)","reasoning":"Análise detalhada em português","new_budget_brl":null}]`

  const userMsg = `Analise estas ${campaigns.length} campanhas (dados dos últimos 7 dias) e tome decisões de otimização:

${JSON.stringify(campaigns.map(c => ({
  campaign_id: c.meta_campaign_id,
  campaign_name: c.name,
  conta: c.account_name,
  status_atual: c.status,
  orcamento_diario_atual: c.daily_budget_brl ? `R$${c.daily_budget_brl.toFixed(0)}/dia` : "Não informado",
  gasto_7d: `R$${c.spend_7d.toFixed(2)}`,
  roas_7d: c.roas_7d > 0 ? `${c.roas_7d.toFixed(2)}x` : "Sem dados",
  cpa_7d: c.cpa_7d > 0 ? `R$${c.cpa_7d.toFixed(2)}` : "Sem dados",
  ctr_7d: `${c.ctr_7d.toFixed(2)}%`,
  cliques_7d: c.clicks_7d,
  conversoes_7d: c.conversions_7d,
  impressoes_7d: c.impressions_7d,
})), null, 2)}`

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    })
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]"
    // Strip possible markdown fences
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
    return JSON.parse(cleaned) as AIDecision[]
  } catch (e) {
    console.error("AI error:", e)
    return []
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Allow cron calls via secret token
  const isCron = request.headers.get("x-cron-secret") === process.env.CRON_SECRET && process.env.CRON_SECRET
  const supabase = await createClient()

  let workspaceId: string
  if (isCron) {
    // Cron: get all enabled workspaces
    const { data: configs } = await supabase.from("optimization_configs").select("workspace_id").eq("is_enabled", true)
    if (!configs || configs.length === 0) return NextResponse.json({ ok: true, message: "Nenhum workspace ativo" })
    // Run for the first one (for multi-workspace support, loop here)
    workspaceId = configs[0].workspace_id
  } else {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
    const workspace = wsList?.[0]
    if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })
    workspaceId = workspace.id
  }

  // Load config
  const { data: configRows } = await supabase.rpc("get_optimization_config", { p_workspace_id: workspaceId })
  const config: OptConfig = configRows?.[0] || { is_enabled: false, goal: "leads", min_roas: 2, max_cpa: 100, min_ctr: 1, budget_increase_pct: 20, max_budget_per_campaign: 500, min_days_running: 3, auto_resume: false, notes: "", selected_account_ids: [], excluded_campaign_ids: [] }
  if (!config.is_enabled && !isCron) {
    // Allow manual run even if disabled for testing
  }

  // Load Meta accounts — filtered by selected BMs if configured
  const { data: allAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspaceId })
  let accounts: MetaAccount[] = (allAccounts || []).filter((a: { platform: string; is_active: boolean }) => a.platform === "meta" && a.is_active)
  if (config.selected_account_ids?.length > 0) {
    accounts = accounts.filter(a => config.selected_account_ids.includes(a.account_id))
  }
  if (accounts.length === 0) return NextResponse.json({ ok: true, message: "Nenhuma conta Meta selecionada ou conectada", decisions: [] })

  // Fetch campaign data — filtered by excluded campaigns if configured
  let campaigns = await fetchCampaignData(accounts)
  if (config.excluded_campaign_ids?.length > 0) {
    campaigns = campaigns.filter(c => !config.excluded_campaign_ids.includes(c.meta_campaign_id))
  }
  if (campaigns.length === 0) return NextResponse.json({ ok: true, message: "Nenhuma campanha encontrada", decisions: [] })

  // Ask AI for decisions
  const decisions = await askAI(campaigns, config)

  // Execute decisions + log
  const results = []
  let pausedCount = 0, resumedCount = 0, budgetCount = 0

  for (const decision of decisions) {
    if (decision.action === "no_action") {
      await supabase.rpc("insert_optimization_log", {
        p_workspace_id: workspaceId,
        p_campaign_id: decision.campaign_id,
        p_campaign_name: decision.campaign_name,
        p_platform: "meta",
        p_account_name: campaigns.find(c => c.meta_campaign_id === decision.campaign_id)?.account_name || "",
        p_action: "no_action",
        p_reason: decision.reason,
        p_reasoning: decision.reasoning,
        p_old_value: null,
        p_new_value: null,
        p_executed: true,
        p_error_message: null,
      })
      results.push({ ...decision, executed: true, error: null })
      continue
    }

    // Find account for this campaign
    const camp = campaigns.find(c => c.meta_campaign_id === decision.campaign_id)
    if (!camp) continue
    const account = accounts.find(a => a.account_id === camp.account_id)
    if (!account) continue

    let newBudgetCents: number | undefined
    if ((decision.action === "increase_budget" || decision.action === "decrease_budget") && decision.new_budget_brl) {
      newBudgetCents = Math.round(decision.new_budget_brl * 100)
    }

    const apiResult = await metaApiAction(decision.campaign_id, decision.action, account.access_token, newBudgetCents)

    await supabase.rpc("insert_optimization_log", {
      p_workspace_id: workspaceId,
      p_campaign_id: decision.campaign_id,
      p_campaign_name: decision.campaign_name,
      p_platform: "meta",
      p_account_name: camp.account_name,
      p_action: decision.action,
      p_reason: decision.reason,
      p_reasoning: decision.reasoning,
      p_old_value: JSON.stringify({ status: camp.status, daily_budget_brl: camp.daily_budget_brl }),
      p_new_value: JSON.stringify({ action: decision.action, new_budget_brl: decision.new_budget_brl }),
      p_executed: apiResult.ok,
      p_error_message: apiResult.error || null,
    })

    if (apiResult.ok) {
      if (decision.action === "pause") pausedCount++
      if (decision.action === "resume") resumedCount++
      if (decision.action === "increase_budget" || decision.action === "decrease_budget") budgetCount++
    }
    results.push({ ...decision, executed: apiResult.ok, error: apiResult.error || null })
  }

  // Generate / update daily report
  const actionsTaken = results.filter(r => r.action !== "no_action" && r.executed)
  const today = new Date().toISOString().split("T")[0]
  const summaryLines = [
    `Ciclo executado em ${new Date().toLocaleTimeString("pt-BR")}.`,
    `${campaigns.length} campanhas analisadas.`,
    pausedCount > 0 ? `${pausedCount} campanha(s) pausada(s).` : "",
    resumedCount > 0 ? `${resumedCount} campanha(s) reativada(s).` : "",
    budgetCount > 0 ? `${budgetCount} orçamento(s) ajustado(s).` : "",
    actionsTaken.length === 0 ? "Todas as campanhas estão operando dentro dos parâmetros configurados." : "",
  ].filter(Boolean).join(" ")

  await supabase.rpc("upsert_optimization_report", {
    p_workspace_id: workspaceId,
    p_report_date: today,
    p_summary: summaryLines,
    p_actions_count: actionsTaken.length,
    p_campaigns_paused: pausedCount,
    p_campaigns_resumed: resumedCount,
    p_budgets_increased: budgetCount,
    p_highlights: JSON.stringify(actionsTaken.slice(0, 5).map(r => ({ action: r.action, campaign: r.campaign_name, reason: r.reason }))),
  })

  return NextResponse.json({
    ok: true,
    campaigns_analyzed: campaigns.length,
    decisions_total: decisions.length,
    actions_executed: actionsTaken.length,
    paused: pausedCount, resumed: resumedCount, budgets_adjusted: budgetCount,
    results,
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  // Return today's report
  const today = new URL(request.url).searchParams.get("date") || new Date().toISOString().split("T")[0]
  const { data } = await supabase.rpc("get_optimization_report", { p_workspace_id: workspace.id, p_date: today })
  return NextResponse.json({ report: data?.[0] || null })
}
