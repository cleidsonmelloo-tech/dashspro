"use client"

import { useState, useRef, useEffect } from "react"
import { CalendarDays, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DateRange {
  since: string  // YYYY-MM-DD
  until: string  // YYYY-MM-DD
}

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().split("T")[0] }
function today() { return new Date() }
function addDays(n: number) { const d = today(); d.setDate(d.getDate() + n); return d }
function startOfMonth(d = today()) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d = today()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function fmtBR(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const PRESETS = [
  { label: "Hoje",              since: () => toISO(today()),          until: () => toISO(today()) },
  { label: "Ontem",             since: () => toISO(addDays(-1)),      until: () => toISO(addDays(-1)) },
  { label: "Últimos 7 dias",    since: () => toISO(addDays(-7)),      until: () => toISO(today()) },
  { label: "Últimos 15 dias",   since: () => toISO(addDays(-15)),     until: () => toISO(today()) },
  { label: "Últimos 30 dias",   since: () => toISO(addDays(-30)),     until: () => toISO(today()) },
  { label: "Este mês",          since: () => toISO(startOfMonth()),   until: () => toISO(endOfMonth()) },
  { label: "Mês passado",       since: () => {
      const d = today(); d.setMonth(d.getMonth() - 1)
      return toISO(startOfMonth(d))
    }, until: () => {
      const d = today(); d.setMonth(d.getMonth() - 1)
      return toISO(endOfMonth(d))
    }
  },
]

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [customSince, setCustomSince] = useState(value.since)
  const [customUntil, setCustomUntil] = useState(value.until)
  const [isCustom, setIsCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Which preset matches current value?
  const activePreset = PRESETS.findIndex(p => p.since() === value.since && p.until() === value.until)

  function applyPreset(p: typeof PRESETS[0]) {
    setIsCustom(false)
    const range = { since: p.since(), until: p.until() }
    onChange(range)
    setCustomSince(range.since)
    setCustomUntil(range.until)
    setOpen(false)
  }

  function applyCustom() {
    if (customSince && customUntil && customSince <= customUntil) {
      onChange({ since: customSince, until: customUntil })
      setIsCustom(true)
      setOpen(false)
    }
  }

  // Button label
  const label = `${fmtBR(value.since)} — ${fmtBR(value.until)}`

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium transition-all",
          open
            ? "border-[#FF5F1A] bg-[#FF5F1A]/10 text-[#FF8C42]"
            : "border-[var(--border)] bg-[#131313] text-[#f4f4f5] hover:border-[#FF5F1A]/40"
        )}
      >
        <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{label}</span>
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform text-[#71717a]", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#0f0f18] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-[#FF5F1A]" />
              Período
            </p>
          </div>

          {/* Presets */}
          <div className="p-2">
            {PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activePreset === i && !isCustom
                    ? "bg-[#FF5F1A]/15 text-[#FF8C42]"
                    : "text-[#a1a1aa] hover:bg-[#1a1a27] hover:text-white"
                )}
              >
                <span>{preset.label}</span>
                {activePreset === i && !isCustom && <Check className="w-3.5 h-3.5 text-[#FF5F1A]" />}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="px-3 pb-3 border-t border-[var(--border)] pt-3">
            <p className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest mb-2">Período personalizado</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[#71717a] mb-1 block">De</label>
                <input
                  type="date"
                  value={customSince}
                  max={customUntil}
                  onChange={e => setCustomSince(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-[var(--border)] bg-[#131313] text-xs text-[#f4f4f5] outline-none focus:border-[#FF5F1A]/60"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#71717a] mb-1 block">Até</label>
                <input
                  type="date"
                  value={customUntil}
                  min={customSince}
                  max={toISO(today())}
                  onChange={e => setCustomUntil(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-[var(--border)] bg-[#131313] text-xs text-[#f4f4f5] outline-none focus:border-[#FF5F1A]/60"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!customSince || !customUntil || customSince > customUntil}
              className="w-full h-8 mt-2 bg-[#FF5F1A] hover:bg-[#5558dd] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Aplicar período
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
