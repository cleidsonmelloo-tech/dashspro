"use client"

import { useState, useTransition } from "react"
import { BarChart3, Building2, Palette, ChevronRight, Check, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createWorkspace } from "@/app/actions/workspace"
import { cn } from "@/lib/utils"

const BRAND_COLORS = [
  "#FF5F1A", "#FF7A33", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#06b6d4",
  "#3b82f6", "#64748b",
]

const FUNNEL_TYPES = [
  { key: "ecommerce", emoji: "🛒", label: "E-commerce", desc: "Loja virtual, produtos físicos ou digitais" },
  { key: "mensagens", emoji: "💬", label: "Mensagens", desc: "WhatsApp, DM, vendas por conversa" },
  { key: "infoproduto", emoji: "🎓", label: "Infoproduto", desc: "Cursos, mentorias, produtos digitais" },
  { key: "cadastro", emoji: "📋", label: "Captação de Leads", desc: "Geração de leads, formulários" },
  { key: "delivery", emoji: "🍕", label: "Delivery / Local", desc: "Pedidos locais, restaurantes, serviços" },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [brandColor, setBrandColor] = useState("#FF5F1A")
  const [logoUrl, setLogoUrl] = useState("")
  const [funnelType, setFunnelType] = useState("ecommerce")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleNext() {
    if (step === 1 && !name.trim()) {
      setError("Digite o nome do seu workspace.")
      return
    }
    setError("")
    setStep(s => s + 1)
  }

  function handleSubmit() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("name", name)
      fd.append("brand_color", brandColor)
      fd.append("logo_url", logoUrl)
      fd.append("funnel_type", funnelType)
      const result = await createWorkspace(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl" style={{ backgroundColor: brandColor }} />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#FF7A33]/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: brandColor }}>
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Bem-vindo ao DashsPro!</h1>
            <p className="text-sm text-[#71717a] mt-1">Configure seu workspace em menos de 1 minuto</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                step > s ? "bg-emerald-500 text-white" : step === s ? "text-white" : "bg-[#1a1410] text-[#52525b]"
              )} style={step === s ? { backgroundColor: brandColor } : {}}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={cn("flex-1 h-0.5 rounded-full", step > s ? "bg-emerald-500" : "bg-[#1a1410]")} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#2a1f15] bg-[#131313] p-8">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-5">
              {error}
            </div>
          )}

          {/* Step 1 — Nome e cor */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-[#FF5F1A]" />
                  <h2 className="text-lg font-semibold text-white">Seu workspace</h2>
                </div>
                <p className="text-sm text-[#71717a]">Como se chama sua agência, negócio ou projeto?</p>
              </div>

              <Input
                label="Nome do workspace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Agência XYZ, Meu Negócio..."
                autoFocus
              />

              <div>
                <label className="text-sm font-medium text-[#a1a1aa] block mb-3">
                  <Palette className="w-4 h-4 inline mr-2 text-[#FF5F1A]" />
                  Cor da marca
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {BRAND_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBrandColor(c)}
                      className={cn(
                        "w-9 h-9 rounded-xl cursor-pointer transition-all border-2",
                        brandColor === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {brandColor === c && <Check className="w-4 h-4 text-white mx-auto" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-9 h-9 rounded-xl cursor-pointer border-2 border-[var(--border)] bg-transparent p-0.5"
                    title="Cor personalizada"
                  />
                </div>
              </div>

              <Button onClick={handleNext} className="w-full h-11 gap-2">
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2 — Tipo de funil */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Qual é o seu modelo de negócio?</h2>
                <p className="text-sm text-[#71717a]">Isso define o funil padrão do seu dashboard (pode mudar depois)</p>
              </div>

              <div className="flex flex-col gap-2">
                {FUNNEL_TYPES.map((ft) => (
                  <button
                    key={ft.key}
                    onClick={() => setFunnelType(ft.key)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border text-left cursor-pointer transition-all",
                      funnelType === ft.key
                        ? "border-[#FF5F1A] bg-[#FF5F1A]/10"
                        : "border-[var(--border)] bg-[#0f0f0f] hover:border-[#FF5F1A]/40"
                    )}
                  >
                    <span className="text-2xl flex-shrink-0">{ft.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{ft.label}</p>
                      <p className="text-xs text-[#71717a] mt-0.5">{ft.desc}</p>
                    </div>
                    {funnelType === ft.key && (
                      <div className="w-5 h-5 rounded-full bg-[#FF5F1A] flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">Voltar</Button>
                <Button onClick={() => setStep(3)} className="flex-1 h-11 gap-2">
                  Próximo <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirmação */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Pronto para começar!</h2>
                <p className="text-sm text-[#71717a]">Confirme as informações do seu workspace</p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[#0f0f0f] p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{name || "Meu Workspace"}</p>
                    <p className="text-xs text-[#71717a]">
                      {FUNNEL_TYPES.find(f => f.key === funnelType)?.emoji}{" "}
                      {FUNNEL_TYPES.find(f => f.key === funnelType)?.label}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-[#2a1f15] p-4 text-sm text-[#71717a]">
                <p className="font-medium text-[#a1a1aa] mb-1">Próximos passos após criar:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Conectar conta Meta Ads em Configurações</li>
                  <li>Conectar conta Google Ads em Configurações</li>
                  <li>Visualizar métricas em tempo real</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11">Voltar</Button>
                <Button onClick={handleSubmit} loading={isPending} className="flex-1 h-11 gap-2">
                  <Rocket className="w-4 h-4" />
                  {isPending ? "Criando..." : "Criar workspace"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
