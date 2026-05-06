"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users, Plus, Trash2, RefreshCw, Crown, Shield,
  Eye, Mail, X, Check, ChevronDown
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, getInitials } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "owner" | "admin" | "viewer"

interface Member {
  id: string
  user_id: string
  role: Role
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
}

const ROLE_CONFIG: Record<Role, {
  label: string; icon: React.ElementType; color: string; bg: string
  description: string
}> = {
  owner:  { label: "Dono",         icon: Crown,  color: "text-amber-400",   bg: "bg-amber-500/15",   description: "Acesso total — não pode ser removido" },
  admin:  { label: "Administrador",icon: Shield, color: "text-blue-400",    bg: "bg-blue-500/15",    description: "Pode gerenciar contas, campanhas e membros" },
  viewer: { label: "Visualizador", icon: Eye,    color: "text-[#71717a]",   bg: "bg-[#2a1f15]",      description: "Apenas leitura — não pode alterar configurações" },
}

const DEMO_MEMBERS: Member[] = [
  { id: "owner", user_id: "1", role: "owner",  full_name: "Você (Demo)",      email: "voce@demo.com",    avatar_url: null, created_at: "2025-01-01" },
  { id: "2",     user_id: "2", role: "admin",  full_name: "Ana Silva",         email: "ana@agencia.com",  avatar_url: null, created_at: "2025-01-10" },
  { id: "3",     user_id: "3", role: "viewer", full_name: "Pedro Mendes",      email: "pedro@cliente.com",avatar_url: null, created_at: "2025-01-15" },
]

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({
  onClose, onInvited,
}: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail]   = useState("")
  const [role, setRole]     = useState<Exclude<Role, "owner">>("viewer")
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError("Email é obrigatório"); return }
    setLoading(true); setError("")

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Erro ao convidar membro"); setLoading(false); return }
      setSuccess(true)
      setTimeout(() => { onInvited(); onClose() }, 1200)
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-white">Convidar Membro</h2>
          <button onClick={onClose} className="text-[#71717a] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Email do usuário</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              disabled={loading || success}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#FF5F1A] transition-colors disabled:opacity-50"
            />
            <p className="text-[10px] text-[#52525b] mt-1">O usuário precisa ter uma conta DashsPro.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Papel no workspace</label>
            <div className="flex flex-col gap-2">
              {(["admin", "viewer"] as Exclude<Role, "owner">[]).map((r) => {
                const cfg = ROLE_CONFIG[r]
                const Icon = cfg.icon
                return (
                  <button
                    key={r} type="button" onClick={() => setRole(r)}
                    disabled={loading || success}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all disabled:opacity-50",
                      role === r
                        ? `${cfg.bg} border-current ${cfg.color}`
                        : "border-[var(--border)] text-[#71717a] hover:border-[#3f3f46]"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", role === r ? cfg.color : "text-current")} />
                    <div>
                      <p className="text-xs font-semibold">{cfg.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{cfg.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error   && <p className="text-xs text-red-400">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />Membro adicionado com sucesso!
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || success}
              className="flex-1 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {loading ? "Convidando..." : "Convidar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Member Row ───────────────────────────────────────────────────────────────
function MemberRow({
  member, isCurrentUser, onDelete, onRoleChange,
}: {
  member: Member
  isCurrentUser: boolean
  onDelete: (id: string) => void
  onRoleChange: (id: string, role: Role) => void
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const rCfg = ROLE_CONFIG[member.role]
  const RoleIcon = rCfg.icon
  const initials = getInitials(member.full_name || member.email || "?")

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[#FF5F1A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
        {member.avatar_url
          ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
          : initials
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {member.full_name || "—"}
          {isCurrentUser && <span className="ml-1.5 text-xs text-[#52525b]">(você)</span>}
        </p>
        <p className="text-xs text-[#71717a] truncate">{member.email}</p>
      </div>

      {/* Role badge / picker */}
      <div className="relative flex-shrink-0">
        {member.role === "owner" ? (
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold", rCfg.bg, rCfg.color)}>
            <RoleIcon className="w-3 h-3" />{rCfg.label}
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors",
                rCfg.bg, rCfg.color, "border-transparent hover:border-current"
              )}
            >
              <RoleIcon className="w-3 h-3" />
              {rCfg.label}
              <ChevronDown className={cn("w-3 h-3 transition-transform", showRoleMenu && "rotate-180")} />
            </button>
            {showRoleMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowRoleMenu(false)} />
                <div className="absolute right-0 top-8 w-44 rounded-xl border border-[var(--border)] bg-[#131313] shadow-2xl z-20 overflow-hidden p-1">
                  {(["admin", "viewer"] as Exclude<Role, "owner">[]).map((r) => {
                    const cfg = ROLE_CONFIG[r]
                    const Ic = cfg.icon
                    return (
                      <button key={r}
                        onClick={() => { onRoleChange(member.id, r); setShowRoleMenu(false) }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors",
                          member.role === r
                            ? `${cfg.bg} ${cfg.color} font-semibold`
                            : "text-[#a1a1aa] hover:bg-[#1a1410] hover:text-white"
                        )}>
                        <Ic className="w-3.5 h-3.5" />{cfg.label}
                        {member.role === r && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Delete */}
      {member.role !== "owner" && !isCurrentUser && (
        <button
          onClick={() => onDelete(member.id)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EquipePage() {
  const [members, setMembers]     = useState<Member[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [usingDemo, setUsingDemo] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/team")
      if (res.ok) {
        const data = await res.json()
        const fetched: Member[] = data.members ?? []
        if (fetched.length > 0) {
          setMembers(fetched)
          setCurrentUserId(fetched.find((m) => m.role === "owner")?.user_id ?? null)
          setUsingDemo(false)
        } else {
          setMembers(DEMO_MEMBERS)
          setUsingDemo(true)
        }
      } else {
        setMembers(DEMO_MEMBERS)
        setUsingDemo(true)
      }
    } catch {
      setMembers(DEMO_MEMBERS)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleDelete(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    if (!usingDemo) {
      await fetch(`/api/team/${id}`, { method: "DELETE" }).catch(() => {})
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m))
    if (!usingDemo) {
      await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).catch(() => {})
    }
  }

  const adminCount  = members.filter((m) => m.role === "admin").length
  const viewerCount = members.filter((m) => m.role === "viewer").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipe</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Gerencie os membros do seu workspace</p>
        </div>
        <div className="flex items-center gap-2">
          {usingDemo && (
            <div className="flex items-center gap-1.5 px-3 h-7 rounded-full border bg-amber-500/10 border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-400">Demo</span>
            </div>
          )}
          <button onClick={fetchMembers}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
            <Plus className="w-4 h-4" />
            Convidar membro
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de membros",    value: members.length,  color: "#FF5F1A", Icon: Users  },
          { label: "Administradores",     value: adminCount,      color: "#3b82f6", Icon: Shield },
          { label: "Visualizadores",      value: viewerCount,     color: "#71717a", Icon: Eye    },
        ].map(({ label, value, color, Icon }) => (
          <Card key={label} className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 60%)` }} />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{loading ? "—" : value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Roles explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={role} className={cn("rounded-xl border p-4", cfg.bg, "border-transparent")}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn("w-4 h-4", cfg.color)} />
                <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
              </div>
              <p className="text-xs text-[#71717a]">{cfg.description}</p>
            </div>
          )
        })}
      </div>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle>Membros do Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-[#1a1410] animate-pulse" />
              ))}
            </div>
          ) : (
            <div>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isCurrentUser={member.user_id === currentUserId || member.role === "owner"}
                  onDelete={handleDelete}
                  onRoleChange={handleRoleChange}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-xl border border-dashed border-[#2a1f15] bg-[#131313]/40 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#FF5F1A]/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-[#FF5F1A]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Como funciona o convite de membros</p>
          <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
            O usuário convidado precisa ter uma conta no DashsPro com o mesmo email.
            Após adicionado, ele verá este workspace na troca de contexto da navbar.
            <span className="text-[#FF5F1A]"> Administradores</span> podem conectar contas de anúncio e gerenciar campanhas.
            <span className="text-[#71717a]"> Visualizadores</span> apenas consultam os dados.
          </p>
        </div>
      </div>

      {showModal && <InviteModal onClose={() => setShowModal(false)} onInvited={fetchMembers} />}
    </div>
  )
}
