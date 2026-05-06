"use client"

import { useState } from "react"
import { Bell, Search, ChevronDown, User, Settings, LogOut, Menu, Zap, CheckCircle2 } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"
import { useUIStore } from "@/store/ui"

interface NavbarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  workspaceName?: string
  workspaceColor?: string
}

export function Navbar({
  userName = "Usuário",
  userEmail = "",
  userAvatar,
  workspaceName = "DashsPro",
  workspaceColor = "#FF5F1A",
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen]     = useState(false)
  const [runningAuto, setRunningAuto]       = useState(false)
  const [autoResult, setAutoResult]         = useState<string | null>(null)
  const { sidebarCollapsed, toggleMobileSidebar } = useUIStore()

  async function runAutomations() {
    setRunningAuto(true)
    setAutoResult(null)
    try {
      const res = await fetch("/api/automations/run", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        const count = (data.triggered ?? []).length
        setAutoResult(count > 0 ? `${count} automação(ões) disparadas` : "Nenhuma condição ativada")
      }
    } catch {
      setAutoResult("Erro ao executar")
    } finally {
      setRunningAuto(false)
      setTimeout(() => setAutoResult(null), 3000)
    }
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border)] bg-[#0a0a0a]/80 backdrop-blur-md z-20 transition-all duration-300",
        "left-0 lg:left-[260px]",
        sidebarCollapsed && "lg:left-16"
      )}
    >
      {/* Left: hamburger (mobile) + search */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileSidebar}
          className="flex lg:hidden items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1410] transition-all"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-3 bg-[#131313] border border-[var(--border)] rounded-lg px-3 h-9 w-64 lg:w-80 group focus-within:border-[#FF5F1A] transition-colors">
          <Search className="w-4 h-4 text-[#52525b] group-focus-within:text-[#FF5F1A] transition-colors flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar campanhas, métricas..."
            className="bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none w-full"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-2.5">

        {/* Run automations button */}
        <div className="relative">
          <button
            onClick={runAutomations}
            disabled={runningAuto}
            title="Executar automações agora"
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs font-medium transition-all",
              runningAuto
                ? "border-[#FF5F1A]/30 bg-[#FF5F1A]/10 text-[#FF8C42] cursor-wait"
                : autoResult
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-white hover:bg-[#1a1410]"
            )}
          >
            {autoResult
              ? <><CheckCircle2 className="w-3.5 h-3.5" /><span className="max-w-[120px] truncate">{autoResult}</span></>
              : <><Zap className={cn("w-3.5 h-3.5", runningAuto && "animate-pulse")} />Automações</>
            }
          </button>
        </div>

        {/* Bell */}
        <a
          href="/dashboard/alertas"
          className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1410] transition-all"
          title="Alertas"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF5F1A]" />
        </a>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-2.5 h-9 rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-all cursor-pointer"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: workspaceColor }}
            >
              {userAvatar
                ? <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                : getInitials(userName)
              }
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs text-[#f4f4f5] font-medium max-w-[90px] truncate">{userName}</span>
              <span className="text-[10px] text-[#52525b] max-w-[90px] truncate">{workspaceName}</span>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-[#71717a] transition-transform duration-200", dropdownOpen && "rotate-180")} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-11 w-56 rounded-xl border border-[var(--border)] bg-[#131313] shadow-2xl z-20 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-xs text-[#71717a] truncate">{userEmail}</p>
                </div>

                {/* Workspace info */}
                <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: workspaceColor }}
                  >
                    <span className="text-white text-[10px] font-bold">{workspaceName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{workspaceName}</p>
                    <p className="text-[10px] text-[#52525b]">Workspace atual</p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1">
                  <a href="/dashboard/perfil" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#a1a1aa] hover:bg-[#1a1410] hover:text-white rounded-lg transition-all">
                    <User className="w-4 h-4" />Meu perfil
                  </a>
                  <a href="/dashboard/equipe" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#a1a1aa] hover:bg-[#1a1410] hover:text-white rounded-lg transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Equipe
                  </a>
                  <a href="/dashboard/configuracoes" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#a1a1aa] hover:bg-[#1a1410] hover:text-white rounded-lg transition-all">
                    <Settings className="w-4 h-4" />Configurações
                  </a>
                  <div className="h-px bg-[var(--border)] my-1" />
                  <form action={signOut}>
                    <button type="submit"
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all w-full cursor-pointer">
                      <LogOut className="w-4 h-4" />Sair
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
