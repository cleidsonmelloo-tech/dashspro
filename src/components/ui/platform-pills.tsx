"use client"

import { cn } from "@/lib/utils"

const PLATFORMS = [
  { value: "meta",   label: "Meta Ads",   color: "#1877f2" },
  { value: "google", label: "Google Ads", color: "#34a853" },
] as const

export type PlatformFilter = string[] // empty = todos

interface PlatformPillsProps {
  value: PlatformFilter
  onChange: (v: PlatformFilter) => void
  /** Se true, o pill fica sempre ativo e não pode ser desmarcado (ex: Keywords = Google fixo) */
  fixed?: string
}

export function PlatformPills({ value, onChange, fixed }: PlatformPillsProps) {
  function toggle(platform: string) {
    if (fixed) return
    const isActive = value.includes(platform)
    if (isActive) {
      // remove — se ficar vazio = todos
      onChange(value.filter(p => p !== platform))
    } else {
      // adiciona
      onChange([...value, platform])
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {PLATFORMS.map(opt => {
        const active = fixed === opt.value || value.includes(opt.value) || (fixed !== opt.value && value.length === 0 && fixed === undefined && false)
        const isActive = fixed === opt.value || value.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            disabled={!!fixed}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-all select-none",
              fixed ? "cursor-default" : "cursor-pointer",
              isActive
                ? "text-white"
                : "border-[var(--border)] bg-[#111118] text-[#71717a] hover:text-white hover:border-[#52525b]"
            )}
            style={isActive ? {
              backgroundColor: `${opt.color}22`,
              borderColor: `${opt.color}55`,
              color: opt.color,
            } : {}}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isActive ? opt.color : "#52525b" }}
            />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** Helper: retorna true se o item deve ser exibido dado o filtro ativo */
export function matchesPlatform(itemPlatform: string, filter: PlatformFilter): boolean {
  if (filter.length === 0) return true          // nenhum filtro = mostra tudo
  return filter.includes(itemPlatform)
}
