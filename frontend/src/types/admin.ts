// Admin Types for Enterprise Dashboard

export interface AdminUser {
  id: string
  email: string
  displayName: string
  role: 'super_admin' | 'tenant_admin' | 'user'
  status: 'active' | 'suspended' | 'pending'
  tenantId: string
  tenantName: string
  azureAdSynced: boolean
  lastLogin?: string
  createdAt: string
  mfaEnabled: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  status: 'active' | 'suspended' | 'trial'
  userCount: number
  agentCount: number
  monthlyTokens: number
  tokenLimit: number
  monthlyCost: number
  createdAt: string
  azureAdTenantId?: string
}

export interface GlobalAgent {
  id: string
  name: string
  template: string
  description: string
  promotionStatus: 'private' | 'pending' | 'promoted' | 'rejected'
  sourceTenantId: string
  sourceTenantName: string
  usageCount: number
  rating: number
  createdAt: string
}

export interface UsageMetric {
  date: string
  tokens: number
  cost: number
  runs: number
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: string
  actor: string
  actorType: 'user' | 'system' | 'agent'
  resource: string
  resourceId: string
  details: string
  severity: 'info' | 'warning' | 'critical'
  tenantId?: string
}

export interface SecurityAlert {
  id: string
  type: 'brute_force' | 'suspicious_login' | 'token_abuse' | 'permission_escalation' | 'data_export'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'investigating' | 'resolved' | 'dismissed'
  title: string
  description: string
  affectedUser?: string
  affectedTenant?: string
  timestamp: string
  resolvedAt?: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalTenants: number
  activeTenants: number
  totalAgents: number
  promotedAgents: number
  monthlyTokens: number
  monthlyRevenue: number
  securityAlerts: number
}
