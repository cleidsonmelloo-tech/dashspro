"use client"

import { useState, useMemo } from "react"
import { Tag, Copy, Check, RefreshCw, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Platform = "meta" | "google" | "tiktok"
type Objective = "vendas" | "leads" | "trafego" | "alcance" | "engajamento"
type Format = "feed" | "stories" | "reels" | "search" | "display" | "video"
type Audience = "novo_publico" | "remarketing" | "lookalike" | "clientes"
type BuyingType = "cbo" | "abo"
type Funnel = "F" | "M" | "B"

const options = {
  platform: [
    { value: "meta" as Platform, label: "Meta Ads" },
    { value: "google" as Platform, label: "Google Ads" },
    { value: "tiktok" as Platform, label: "TikTok Ads" },
  ],
  objective: [
    { value: "vendas" as Objective, label: "Vendas" },
    { value: "leads" as Objective, label: "Leads" },
    { value: "trafego" as Objective, label: "Tráfego" },
    { value: "alcance" as Objective, label: "Alcance" },
    { value: "engajamento" as Objective, label: "Engajamento" },
  ],
  format: [
    { value: "feed" as Format, label: "Feed" },
    { value: "stories" as Format, label: "Stories" },
    { value: "reels" as Format, label: "Reels" },
    { value: "search" as Format, label: "Search" },
    { value: "display" as Format, label: "Display" },
    { value: "video" as Format, label: "Vídeo" },
  ],
  audience: [
    { value: "novo_publico" as Audience, label: "Novo Público" },
    { value: "remarketing" as Audience, label: "Remarketing" },
    { value: "lookalike" as Audience, label: "Lookalike" },
    { value: "clientes" as Audience, label: "Clientes" },
  ],
  buyingType: [
    { value: "cbo" as BuyingType, label: "CBO" },
    { value: "abo" as BuyingType, label: "ABO" },
  ],
  funnel: [
    { value: "F" as Funnel, label: "Topo (F)" },
    { value: "M" as Funnel, label: "Meio (M)" },
    { value: "B" as Funnel, label: "Fundo (B)" },
  ],
}

const audienceMap: Record<Audience, string> = {
  novo_publico: "NP",
  remarketing: "RMK",
  lookalike: "LAL",
  clientes: "CLI",
}

const formatMap: Record<Format, string> = {
  feed: "FEED",
  stories: "STORIES",
  reels: "REELS",
  search: "SEARCH",
  display: "DISPLAY",
  video: "VIDEO",
}

const objectiveMap: Record<Objective, string> = {
  vendas: "VENDAS",
  leads: "LEADS",
  trafego: "TRAFEGO",
  alcance: "ALCANCE",
  engajamento: "ENGAJ",
}

interface NomConfig {
  platform: Platform
  productName: string
  objective: Objective
  format: Format
  audience: Audience
  buyingType: BuyingType
  funnel: Funnel
  version: string
  extra: string
}

function SelectGroup({ label, options: opts, value, onChange, info }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  info?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[#a1a1aa]">{label}</span>
        {info && <span title={info}><Info className="w-3.5 h-3.5 text-[#52525b]" /></span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
              value === opt.value
                ? "bg-[#6366f1] border-[#6366f1] text-white"
                : "bg-[#0d0d14] border-[var(--border)] text-[#71717a] hover:text-white hover:border-[#6366f1]/40"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[#1e1e2e] text-xs text-[#a1a1aa] hover:text-white hover:border-[#6366f1]/40 transition-all cursor-pointer"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  )
}

export default function NomenclaturaPage() {
  const [config, setConfig] = useState<NomConfig>({
    platform: "meta",
    productName: "MeuProduto",
    objective: "vendas",
    format: "reels",
    audience: "novo_publico",
    buyingType: "cbo",
    funnel: "F",
    version: "1",
    extra: "",
  })

  const update = (key: keyof NomConfig) => (value: string) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  const generated = useMemo(() => {
    const obj = objectiveMap[config.objective]
    const fmt = formatMap[config.format]
    const aud = audienceMap[config.audience]
    const by = config.buyingType.toUpperCase()
    const fn = config.funnel
    const prod = config.productName.replace(/\s+/g, "_").toUpperCase()
    const v = config.version.padStart(2, "0")
    const extra = config.extra ? `_${config.extra.replace(/\s+/g, "_").toUpperCase()}` : ""

    return {
      campaign: `[${obj}] [${prod}] [${fn}] [${by}]`,
      adset: `[${fmt}] [${fn}] [${aud}]${extra}`,
      ad: `AD${v} - [${fmt}] [${fn}] - ${config.productName}${extra} [V${v}]`,
      utm: `utm_campaign=[${obj}]_[${prod}]_[${by}]&utm_medium=${config.platform === "meta" ? "paid_social" : "cpc"}&utm_source=${config.platform}&utm_content=AD${v}_[${fmt}]_[${fn}]${extra}&publicos=${config.audience}`,
    }
  }, [config])

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Nomenclatura Automática</h1>
        <p className="text-sm text-[#71717a] mt-0.5">Gere nomes padronizados para campanhas, conjuntos, anúncios e UTMs</p>
      </div>

      {/* Configurador */}
      <Card>
        <CardHeader>
          <CardTitle>Configurar Nomenclatura</CardTitle>
          <CardDescription>Selecione as opções e os nomes serão gerados automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <SelectGroup label="Plataforma" options={options.platform} value={config.platform} onChange={update("platform")} />
            <SelectGroup label="Objetivo" options={options.objective} value={config.objective} onChange={update("objective")} />
            <SelectGroup label="Formato" options={options.format} value={config.format} onChange={update("format")} />
            <SelectGroup label="Audiência" options={options.audience} value={config.audience} onChange={update("audience")} />
            <SelectGroup label="Tipo de Compra" options={options.buyingType} value={config.buyingType} onChange={update("buyingType")} />
            <SelectGroup label="Etapa do Funil" options={options.funnel} value={config.funnel} onChange={update("funnel")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a1a1aa]">Nome do Produto/Serviço</label>
              <input
                type="text"
                value={config.productName}
                onChange={(e) => update("productName")(e.target.value)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[#111118] px-3 text-sm text-white outline-none focus:border-[#6366f1]"
                placeholder="MeuProduto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a1a1aa]">Versão do Ad</label>
              <input
                type="number"
                value={config.version}
                onChange={(e) => update("version")(e.target.value)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[#111118] px-3 text-sm text-white outline-none focus:border-[#6366f1]"
                min={1} max={99}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#a1a1aa]">Identificador Extra (opcional)</label>
              <input
                type="text"
                value={config.extra}
                onChange={(e) => update("extra")(e.target.value)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[#111118] px-3 text-sm text-white outline-none focus:border-[#6366f1]"
                placeholder="Ex: Gladstone, Black"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      <Card className="bg-[#0d0d14]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#6366f1]" />
            <CardTitle>Nomenclaturas Geradas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            { label: "🎯 Campanha", value: generated.campaign, color: "#6366f1" },
            { label: "👥 Conjunto de Anúncios", value: generated.adset, color: "#8b5cf6" },
            { label: "🎨 Anúncio", value: generated.ad, color: "#06b6d4" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[#111118] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wide">{item.label}</span>
                <CopyButton text={item.value} />
              </div>
              <code className="text-sm font-mono" style={{ color: item.color }}>{item.value}</code>
            </div>
          ))}

          {/* UTM */}
          <div className="rounded-xl border border-[var(--border)] bg-[#111118] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wide">🔗 UTM Parameters</span>
              <CopyButton text={generated.utm} />
            </div>
            <code className="text-xs font-mono text-[#a78bfa] break-all leading-relaxed">{generated.utm}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
