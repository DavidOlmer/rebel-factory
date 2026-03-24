// Rebel AI Factory - Type Definitions

export type Tier = 'core' | 'venture' | 'personal';
export type Category = 'rebelgroup' | 'entertainment' | 'travel' | 'services' | 'innovation';
export type Status = 'active' | 'inactive' | 'pending' | 'error';
export type AlertType = 'warning' | 'success' | 'info' | 'error';

export interface Agent {
  id: string;
  name: string;
  description: string;
  tier: Tier;
  category: Category;
  status: Status;
  qualityScore: number;
  runCount: number;
  lastRun?: string;
  costPerRun: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: Category;
  tier: Tier;
  usageCount: number;
  rating: number;
  createdAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  category: Category;
  usageCount: number;
  rating: number;
  version: string;
}

export interface Insight {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  actionRequired: boolean;
}

export interface Approval {
  id: string;
  type: 'agent' | 'template' | 'prompt' | 'budget';
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  tier: Tier;
  estimatedCost?: number;
}

export interface Stat {
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
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
