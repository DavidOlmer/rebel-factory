import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_BASE = '/api'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

// Types
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

// Hooks
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchApi<Agent[]>('/agents'),
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => fetchApi<Agent>(`/agents/${id}`),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Agent>) =>
      fetchApi<Agent>('/agents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useSprints() {
  return useQuery({
    queryKey: ['sprints'],
    queryFn: () => fetchApi<Sprint[]>('/sprints'),
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => fetchApi<Template[]>('/templates'),
  })
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => fetchApi<{
      totalAgents: number
      activeAgents: number
      completedSprints: number
      successRate: number
    }>('/stats'),
  })
}
