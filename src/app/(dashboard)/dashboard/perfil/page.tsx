"use client"

import { useState, useEffect, useTransition } from "react"
import { User, Mail, Lock, Shield, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { getInitials, cn } from "@/lib/utils"

interface Profile {
  id: string; email: string; full_name: string | null; avatar_url: string | null
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single()

      setProfile({ id: user.id, email: user.email || "", full_name: p?.full_name || null, avatar_url: p?.avatar_url || null })
      setFullName(p?.full_name || "")
      setLoading(false)
    }
    loadProfile()
  }, [])

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  function handleSaveProfile() {
    startTransition(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id)

      if (error) showFeedback("error", "Erro ao salvar perfil.")
      else {
        showFeedback("success", "Perfil atualizado com sucesso!")
        setProfile((p) => p ? { ...p, full_name: fullName.trim() } : p)
      }
    })
  }

  function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      showFeedback("error", "As senhas não coincidem.")
      return
    }
    if (newPassword.length < 6) {
      showFeedback("error", "A senha deve ter pelo menos 6 caracteres.")
      return
    }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) showFeedback("error", error.message)
      else {
        showFeedback("success", "Senha alterada com sucesso!")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[#71717a]">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando perfil...</span>
      </div>
    )
  }

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "Usuário"
  const initials = getInitials(displayName)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
        <p className="text-sm text-[#71717a] mt-0.5">Gerencie suas informações pessoais e segurança da conta</p>
      </div>

      {feedback && (
        <div className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
          feedback.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        )}>
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* Avatar + info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#6366f1]" />
            <div>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>Seu nome exibido no sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#6366f1] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="font-semibold text-white">{displayName}</p>
              <p className="text-sm text-[#71717a]">{profile?.email}</p>
            </div>
          </div>

          <Input
            label="Nome completo"
            placeholder="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="E-mail"
            value={profile?.email || ""}
            disabled
            className="opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-[#52525b]">O e-mail é vinculado à conta e não pode ser alterado.</p>
          <Button onClick={handleSaveProfile} loading={isPending} className="w-fit">
            Salvar nome
          </Button>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#6366f1]" />
            <div>
              <CardTitle>Segurança</CardTitle>
              <CardDescription>Altere sua senha de acesso</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            label="Nova senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            placeholder="Repita a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button onClick={handleChangePassword} loading={isPending} variant="outline" className="w-fit">
            Alterar senha
          </Button>
        </CardContent>
      </Card>

      {/* Info conta */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6366f1]" />
            <div>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>Detalhes técnicos da sua conta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-sm text-[#71717a]">ID do usuário</span>
              <span className="text-xs font-mono text-[#52525b] truncate max-w-[200px]">{profile?.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-sm text-[#71717a]">Tipo de conta</span>
              <span className="text-sm text-white">Proprietário</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-[#71717a]">Plano</span>
              <span className="text-sm font-semibold text-emerald-400">Gratuito</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
