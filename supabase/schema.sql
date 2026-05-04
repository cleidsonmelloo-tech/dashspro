-- =====================================================
-- DASHSPRO — Schema SQL para Supabase
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- =====================================================
-- WORKSPACES (conta da agência/gestor)
-- =====================================================
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo_url text,
  brand_color text not null default '#6366f1',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- WORKSPACE MEMBERS (membros da equipe)
-- =====================================================
create table public.workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'viewer')) default 'viewer',
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- =====================================================
-- PROFILES (dados públicos do usuário)
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- AD ACCOUNTS (contas de anúncio vinculadas)
-- =====================================================
create table public.ad_accounts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google')),
  account_id text not null,
  account_name text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, platform, account_id)
);

-- =====================================================
-- WORKSPACE SETTINGS (configurações do workspace)
-- =====================================================
create table public.workspace_settings (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade unique,
  funnel_type text not null check (funnel_type in ('ecommerce', 'mensagens', 'infoproduto', 'cadastro', 'delivery')) default 'ecommerce',
  default_currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

-- =====================================================
-- ALERTS (alertas de métricas configurados pelo usuário)
-- =====================================================
create table public.alerts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  metric text not null,
  operator text not null check (operator in ('gt', 'lt', 'gte', 'lte')),
  threshold numeric not null,
  severity text not null check (severity in ('info', 'warning', 'critical')) default 'warning',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;
create policy "Members can view alerts" on public.alerts
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.user_id = auth.uid())
    )
  );
create policy "Admins can manage alerts" on public.alerts
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (
        w.owner_id = auth.uid() or
        (wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
      )
    )
  );

-- =====================================================
-- GOALS (metas de performance / OKRs)
-- =====================================================
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  metric text not null,
  target numeric not null,
  period text not null check (period in ('week', 'month', 'quarter')) default 'month',
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
create policy "Members can view goals" on public.goals
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.user_id = auth.uid())
    )
  );
create policy "Admins can manage goals" on public.goals
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (
        w.owner_id = auth.uid() or
        (wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
      )
    )
  );

-- =====================================================
-- AUTOMATIONS (regras de automação de campanhas)
-- =====================================================
create table public.automations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  metric text not null,
  operator text not null check (operator in ('gt', 'lt', 'gte', 'lte')),
  threshold numeric not null,
  action text not null check (action in ('pause_campaign', 'increase_budget', 'decrease_budget', 'notify')),
  action_value numeric,
  platform text check (platform in ('meta', 'google', 'all')) default 'all',
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.automations enable row level security;
create policy "Members can view automations" on public.automations
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.user_id = auth.uid())
    )
  );
create policy "Admins can manage automations" on public.automations
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (
        w.owner_id = auth.uid() or
        (wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
      )
    )
  );

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Cria profile automaticamente quando usuário se registra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atualiza updated_at automaticamente
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.workspace_settings enable row level security;

-- Profiles: usuário vê/edita apenas o próprio perfil
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Workspaces: membro pode ver, owner pode modificar
create policy "Members can view workspace" on public.workspaces
  for select using (
    owner_id = auth.uid() or
    exists (select 1 from public.workspace_members where workspace_id = id and user_id = auth.uid())
  );
create policy "Owner can insert workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy "Owner can update workspace" on public.workspaces
  for update using (owner_id = auth.uid());

-- Ad accounts: membros do workspace podem ver
create policy "Members can view ad accounts" on public.ad_accounts
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.user_id = auth.uid())
    )
  );
create policy "Admins can manage ad accounts" on public.ad_accounts
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (
        w.owner_id = auth.uid() or
        (wm.user_id = auth.uid() and wm.role in ('owner', 'admin'))
      )
    )
  );

-- Workspace settings: igual ao workspace
create policy "Members can view settings" on public.workspace_settings
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.user_id = auth.uid())
    )
  );
create policy "Admins can update settings" on public.workspace_settings
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );
