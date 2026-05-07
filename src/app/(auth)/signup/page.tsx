"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Mail, Lock, User, Eye, EyeOff, BarChart3, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signUp } from "@/app/actions/auth"

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setSuccess("")
    const formData = new FormData(e.currentTarget)

    if (formData.get("password") !== formData.get("confirm_password")) {
      setError("As senhas não coincidem.")
      return
    }

    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) setError(result.error)
      if (result?.success) setSuccess(result.success)
    })
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[#2a1f15] bg-[#131313] p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Quase lá!</h2>
        <p className="text-sm text-[#71717a]">{success}</p>
        <Link href="/login">
          <Button variant="outline" className="mt-2">Ir para o login</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#FF5F1A]">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Sistema do Meta e Google Ads</h1>
          <p className="text-sm text-[#71717a] mt-1">Crie sua conta gratuitamente</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2a1f15] bg-[#131313] p-8 flex flex-col gap-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            name="full_name"
            label="Nome completo"
            type="text"
            placeholder="Seu nome"
            leftIcon={<User className="w-4 h-4" />}
            required
          />
          <Input
            name="email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            name="password"
            label="Senha"
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cursor-pointer hover:text-[#f4f4f5] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
            minLength={8}
          />
          <Input
            name="confirm_password"
            label="Confirmar senha"
            type={showPassword ? "text" : "password"}
            placeholder="Repita a senha"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <Button type="submit" loading={isPending} className="w-full h-11 mt-1">
            {isPending ? "Criando conta..." : "Criar conta grátis"}
          </Button>
        </form>

        <p className="text-center text-sm text-[#71717a]">
          Já tem conta?{" "}
          <Link href="/login" className="text-[#FF5F1A] hover:text-[#FF8C42] font-medium transition-colors">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
