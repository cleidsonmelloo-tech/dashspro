# DashsPro — Guia Completo de Deploy e Configuração

## 1. Configurar o Supabase (grátis)

1. Acesse https://supabase.com e crie uma conta
2. Crie um novo projeto (região: **South America — São Paulo**)
3. Vá em **SQL Editor** e cole o conteúdo de `supabase/schema.sql`
4. Clique em **Run**
5. Vá em **Project Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Configurar o Meta Ads (OAuth)

1. Acesse https://developers.facebook.com → **My Apps → Create App**
2. Tipo: **Business**
3. Em **Products**, adicione **Marketing API**
4. Em **Settings → Basic**, copie:
   - `App ID` → `META_APP_ID`
   - `App Secret` → `META_APP_SECRET`
5. Em **Facebook Login → Settings**, adicione nas **Valid OAuth Redirect URIs**:
   ```
   https://seu-dominio.vercel.app/api/auth/meta/callback
   http://localhost:3000/api/auth/meta/callback
   ```
6. Em **App Review**, adicione as permissões:
   - `ads_read`, `ads_management`, `business_management`, `read_insights`

---

## 3. Configurar o Google Ads (OAuth)

1. Acesse https://console.cloud.google.com → crie um projeto
2. Vá em **APIs & Services → Library** e ative **Google Ads API**
3. Vá em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Tipo: **Web Application**
   - Authorized redirect URIs:
     ```
     https://seu-dominio.vercel.app/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback
     ```
4. Copie:
   - `Client ID` → `GOOGLE_CLIENT_ID`
   - `Client Secret` → `GOOGLE_CLIENT_SECRET`
5. Solicite um **Developer Token** em https://developers.google.com/google-ads/api/docs/first-call/dev-token
   - → `GOOGLE_DEVELOPER_TOKEN`

---

## 4. Variáveis de Ambiente

Edite o arquivo `dashspro/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=DashsPro

# Meta Ads
META_APP_ID=seu_meta_app_id
META_APP_SECRET=seu_meta_app_secret

# Google Ads
GOOGLE_CLIENT_ID=seu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GOOGLE_DEVELOPER_TOKEN=seu_developer_token
```

---

## 5. Rodar localmente

```bash
cd dashspro
npm install
npm run dev
```

Acesse: http://localhost:3000

---

## 6. Deploy no Vercel (grátis)

### Opção A — via GitHub (recomendado)
1. Faça push do projeto para um repositório no GitHub
2. Acesse https://vercel.com → **New Project** → importe o repositório
3. Configure:
   - **Root Directory**: `dashspro`
   - **Framework Preset**: Next.js (detectado automaticamente)
4. Em **Environment Variables**, adicione todas as vars do `.env.local`
   - Altere `NEXT_PUBLIC_APP_URL` para `https://seu-projeto.vercel.app`
5. Clique em **Deploy**

### Opção B — via CLI
```bash
npm i -g vercel
cd dashspro
vercel --prod
```

---

## 7. Configurações pós-deploy

### Supabase
Em **Authentication → URL Configuration**:
- **Site URL**: `https://seu-projeto.vercel.app`
- **Redirect URLs**: `https://seu-projeto.vercel.app/dashboard`

### Meta Ads
Adicione a URL de produção nas Redirect URIs do seu app Facebook.

### Google Ads
Adicione a URL de produção nas Authorized redirect URIs do seu OAuth client.

---

## 8. Estrutura do projeto

```
dashspro/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Login, Signup, Forgot Password
│   │   ├── (dashboard)/layout.tsx     # Layout com Sidebar + Navbar
│   │   │   └── dashboard/
│   │   │       ├── page.tsx           # Dashboard (dados reais + demo)
│   │   │       ├── funil/             # Funil adaptável (5 tipos)
│   │   │       ├── campanhas/         # Tabela de campanhas (real + demo)
│   │   │       ├── criativos/         # Galeria de criativos (real + demo)
│   │   │       ├── keywords/          # Keywords Google Ads (real + demo)
│   │   │       ├── projecao/          # Calculadora de verba
│   │   │       ├── nomenclatura/      # Gerador de nomenclatura + UTMs
│   │   │       ├── configuracoes/     # OAuth connect + contas
│   │   │       └── perfil/            # Perfil do usuário
│   │   ├── api/
│   │   │   ├── auth/meta/             # OAuth Meta: início + callback
│   │   │   ├── auth/google/           # OAuth Google: início + callback
│   │   │   ├── meta/metrics/          # Métricas agregadas Meta
│   │   │   ├── meta/campaigns/        # Campanhas Meta
│   │   │   ├── meta/creatives/        # Criativos Meta
│   │   │   ├── google/campaigns/      # Campanhas Google
│   │   │   ├── google/keywords/       # Keywords Google
│   │   │   └── dashboard/metrics/     # Métricas consolidadas Meta+Google
│   │   ├── actions/
│   │   │   ├── auth.ts                # signIn, signUp, signOut
│   │   │   └── workspace.ts           # CRUD workspace + contas
│   │   └── onboarding/                # Wizard 3 etapas
│   ├── components/
│   │   ├── ui/                        # Button, Input, Card, Badge
│   │   ├── layout/                    # Sidebar (collapse), Navbar
│   │   └── dashboard/                 # PerformanceChart (Recharts)
│   ├── lib/
│   │   ├── supabase/                  # Browser + Server clients
│   │   └── utils.ts                   # cn, formatCurrency, formatNumber...
│   ├── store/ui.ts                    # Zustand (sidebar collapse)
│   ├── types/index.ts                 # Tipos TypeScript
│   └── middleware.ts                  # Auth guard
├── supabase/schema.sql                # SQL completo (executar no Supabase)
└── .env.local                         # Variáveis de ambiente
```

---

## 9. Funcionalidades implementadas

| Funcionalidade | Status |
|---|---|
| Auth (login, signup, esqueci senha) | ✅ |
| Onboarding 3 etapas | ✅ |
| Dashboard consolidado Meta+Google | ✅ Real + Demo |
| Funil adaptável (5 tipos) | ✅ |
| Tabela de campanhas + UTMs | ✅ Real + Demo |
| Galeria de criativos | ✅ Real + Demo |
| Keywords Google Ads | ✅ Real + Demo |
| Projeção de verba | ✅ |
| Gerador de nomenclatura | ✅ |
| OAuth Meta Ads | ✅ |
| OAuth Google Ads | ✅ |
| Token refresh automático (Google) | ✅ |
| Configurações + disconnect de contas | ✅ |
| Página de perfil | ✅ |
| Sidebar collapse (Zustand) | ✅ |
| Multi-workspace (RLS Supabase) | ✅ |
