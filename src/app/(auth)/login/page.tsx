"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Mail, Lock, Eye, EyeOff, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn } from "@/app/actions/auth"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#FF5F1A]">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">DashsPro</h1>
          <p className="text-sm text-[#71717a] mt-1">Faça login na sua conta</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-[#2a1f15] bg-[#131313] p-8 flex flex-col gap-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            name="email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <Input
            name="password"
            label="Senha"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
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
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-[#FF5F1A] hover:text-[#FF8C42] transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" loading={isPending} className="w-full h-11">
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-[#71717a]">
          Não tem conta?{" "}
          <Link href="/signup" className="text-[#FF5F1A] hover:text-[#FF8C42] font-medium transition-colors">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
