"use client"

import { cn } from "@/lib/utils"

const PLATFORMS = [
  { value: "meta",   label: "Meta Ads",   color: "#1877f2" },
  { value: "google", label: "Google Ads", color: "#34a853" },
] as const

type PlatformValue = "all" | "meta" | "google"

interface PlatformPillsProps {
  value: PlatformValue
  onChange: (v: PlatformValue) => void
}

export function PlatformPills({ value, onChange }: PlatformPillsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {PLATFORMS.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(active ? "all" : opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-all cursor-pointer select-none",
              active
                ? "text-white"
                : "border-[var(--border)] bg-[#111118] text-[#71717a] hover:text-white hover:border-[#52525b]"
            )}
            style={active ? {
              backgroundColor: `${opt.color}22`,
              borderColor: `${opt.color}55`,
              color: opt.color,
            } : {}}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: active ? opt.color : "#52525b" }}
            />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
