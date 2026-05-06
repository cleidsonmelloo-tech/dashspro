"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3, LayoutDashboard, TrendingUp, Target,
  Image, Search, DollarSign, Tag, Settings, LogOut,
  ChevronLeft, ChevronRight, User, X, FileText, Bell, Flag, GitCompare, Zap, Users, Bot
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"
import { useUIStore } from "@/store/ui"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/funil", icon: TrendingUp, label: "Funil" },
  { href: "/dashboard/campanhas", icon: Target, label: "Campanhas" },
  { href: "/dashboard/otimizacao", icon: Bot, label: "Otimizador de Campanha" },
  { href: "/dashboard/criativos", icon: Image, label: "Criativos" },
  { href: "/dashboard/keywords", icon: Search, label: "Keywords" },
  { href: "/dashboard/projecao", icon: DollarSign, label: "Projeção de Verba" },
  { href: "/dashboard/nomenclatura", icon: Tag, label: "Nomenclatura" },
  { href: "/dashboard/relatorios", icon: FileText, label: "Relatórios" },
  { href: "/dashboard/alertas", icon: Bell, label: "Alertas" },
  { href: "/dashboard/metas", icon: Flag, label: "Metas" },
  { href: "/dashboard/comparativo", icon: GitCompare, label: "Comparativo" },
  { href: "/dashboard/automacoes", icon: Zap, label: "Automações" },
  { href: "/dashboard/equipe", icon: Users, label: "Equipe" },
  { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
  { href: "/dashboard/perfil", icon: User, label: "Meu Perfil" },
]

interface SidebarProps {
  workspaceName?: string
  workspaceLogo?: string
  brandColor?: string
}

function SidebarContent({
  workspaceName = "DashsPro",
  workspaceLogo,
  brandColor = "#FF5F1A",
  collapsed,
  onClose,
}: SidebarProps & { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const { toggleSidebar } = useUIStore()

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-16 border-b border-[var(--border)] flex-shrink-0",
        collapsed && "justify-center px-0"
      )}>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          {workspaceLogo
            ? <img src={workspaceLogo} alt={workspaceName} className="w-5 h-5 object-contain rounded" />
            : <BarChart3 className="w-4 h-4 text-white" />
          }
        </div>
        {!collapsed && (
          <span className="font-semibold text-white text-sm truncate flex-1">{workspaceName}</span>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 text-[#71717a] hover:text-white lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group relative",
                isActive
                  ? "bg-gradient-to-r from-[#FF5F1A] to-[#E54E0B] text-white shadow-lg shadow-[#FF5F1A]/30"
                  : "text-[#a1a1aa] hover:bg-[#1a1410] hover:text-[#f4f4f5]",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 flex-shrink-0",
                isActive ? "text-white" : "text-current"
              )} />
              {!collapsed && <span className="truncate">{item.label}</span>}

              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-white"
                />
              )}

              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#1a1410] border border-[var(--border)] text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-4 border-t border-[var(--border)] flex flex-col gap-1 flex-shrink-0">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "hidden lg:flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-[#1a1410] hover:text-[#f4f4f5] transition-all w-full cursor-pointer",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>
          }
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-red-500/10 hover:text-red-400 transition-all w-full cursor-pointer",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </div>
  )
}

export function Sidebar({ workspaceName, workspaceLogo, brandColor }: SidebarProps) {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen border-r border-[var(--border)] bg-[#0f0f0f] z-30 transition-all duration-300",
          "hidden lg:flex flex-col",
          sidebarCollapsed ? "w-16" : "w-[260px]"
        )}
      >
        <SidebarContent
          workspaceName={workspaceName}
          workspaceLogo={workspaceLogo}
          brandColor={brandColor}
          collapsed={sidebarCollapsed}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-[260px] flex flex-col border-r border-[var(--border)] bg-[#0f0f0f] z-50 transition-transform duration-300 lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          workspaceName={workspaceName}
          workspaceLogo={workspaceLogo}
          brandColor={brandColor}
          collapsed={false}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </aside>
    </>
  )
}
