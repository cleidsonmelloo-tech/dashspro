export type UserRole = "owner" | "admin" | "viewer"

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url?: string
  brand_color: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface AdAccount {
  id: string
  workspace_id: string
  platform: "meta" | "google"
  account_id: string
  account_name: string
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  is_active: boolean
  created_at: string
}

export type FunnelType = "ecommerce" | "mensagens" | "infoproduto" | "cadastro" | "delivery"

export interface WorkspaceSettings {
  id: string
  workspace_id: string
  funnel_type: FunnelType
  default_currency: string
  timezone: string
  updated_at: string
}

export interface MetricCard {
  label: string
  value: string | number
  change?: number
  changeType?: "positive" | "negative" | "neutral"
  prefix?: string
  suffix?: string
}

export interface DateRange {
  from: Date
  to: Date
}
