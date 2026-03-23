export interface Agent {
  id: string
  name: string
  template: string
  status: 'idle' | 'running' | 'error'
  createdAt: string
  lastActivity?: string
  config: Record<string, unknown>
}

export interface Sprint {
  id: string
  agentId: string
  agentName: string
  task: string
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'failed'
  qualityGates: QualityGate[]
  createdAt: string
  completedAt?: string
}

export interface QualityGate {
  name: string
  status: 'pending' | 'passed' | 'failed'
  details?: string
}

export interface Template {
  id: string
  name: string
  description: string
  yaml: string
}

export interface Stats {
  totalAgents: number
  activeAgents: number
  completedSprints: number
  successRate: number
}
