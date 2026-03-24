// Rebel AI Factory - Type Definitions

export type Tier = 'core' | 'venture' | 'personal';
export type Category = 'rebelgroup' | 'entertainment' | 'travel' | 'services' | 'innovation';
export type Status = 'active' | 'inactive' | 'pending' | 'error' | 'idle' | 'running' | 'paused' | 'archived';
export type AlertType = 'warning' | 'success' | 'info' | 'error';

export interface Agent {
  id: string;
  name: string;
  creature?: string;
  emoji?: string;
  description?: string;
  tier: Tier;
  category?: Category;
  status: Status;
  model?: string;
  skills?: string[];
  qualityScore?: number;
  avgQuality?: number;
  runCount?: number;
  totalRuns?: number;
  lastRun?: string;
  costPerRun?: number;
  ownerId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category: Category | string;
  icon?: string;
  tier?: Tier;
  usageCount?: number;
  rating?: number;
  createdAt?: string;
}

export interface Prompt {
  id: string;
  name: string;
  slug?: string;
  content: string;
  category: Category | string;
  usageCount: number;
  rating: number;
  version: string;
}

export interface Insight {
  id: string;
  level: 'individual' | 'venture' | 'rebel';
  type: 'drift_warning' | 'pattern' | 'optimization' | 'anomaly';
  title: string;
  description: string;
  message?: string; // alias for description
  confidence: number;
  impactEstimate: 'low' | 'medium' | 'high';
  status: 'detected' | 'acknowledged' | 'resolved';
  createdAt?: string;
  timestamp?: string;
  actionRequired?: boolean;
}

export interface Approval {
  id: string;
  type: 'agent' | 'template' | 'prompt' | 'budget' | 'agent_promotion' | 'template_publish';
  title: string;
  description?: string;
  requestedBy?: string;
  requesterName?: string;
  requestedAt?: string;
  createdAt?: string;
  tier?: Tier;
  status?: 'pending' | 'approved' | 'rejected';
  estimatedCost?: number;
}

export interface Stat {
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  icon?: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface CostBreakdown {
  model: string;
  tier: Tier;
  amount: number;
  percentage: number;
}

// Dashboard types
export interface DashboardStats {
  activeAgents: number;
  activeAgentsTrend: number;
  totalRunsToday: number;
  totalRunsTrend: number;
  avgQualityScore: number;
  qualityTrend: number;
  monthlySpend: number;
  spendTrend: number;
}

export interface BudgetOverview {
  coreTier: { used: number; limit: number };
  ventureTier: { used: number; limit: number };
  personalTier: { used: number; limit: number };
}

export interface RecentActivity {
  agent: string;
  action: string;
  time: string;
  status: 'success' | 'error' | 'info';
}

export interface DashboardData {
  stats: DashboardStats;
  insights: Insight[];
  budget: BudgetOverview;
  recentActivity: RecentActivity[];
}

// Prompts types
export interface PromptsData {
  prompts: Prompt[];
  stats: {
    totalPrompts: number;
    totalUses: number;
    avgRating: number;
  };
}

// Costs types
export interface BudgetData {
  totalBudget: number;
  spent: number;
  projected: number;
  remaining: number;
}

export interface TierBudget {
  tier: Tier;
  budget: number;
  spent: number;
}

export interface ModelCost {
  model: string;
  tier: Tier;
  amount: number;
  percentage: number;
}

export interface DailySpend {
  day: string;
  amount: number;
}

export interface CostsData {
  budget: BudgetData;
  tierBudgets: TierBudget[];
  modelCosts: ModelCost[];
  dailySpend: DailySpend[];
}
