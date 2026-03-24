/**
 * REBEL AI FACTORY - FRONTEND API ROUTES
 * REBAA-30/31: API endpoints tailored to frontend component expectations
 * 
 * These routes return data in the exact shape the React frontend expects.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { extractUser } from '../middleware/auth';

const router = Router();

// ============================================
// AGENTS - Returns Agent[] directly
// ============================================
router.get('/agents', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, tier, status } = req.query;
    
    let agents = [];
    
    try {
      const filters: string[] = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (tenantId) {
        filters.push(`tenant_id = $${paramIndex++}`);
        params.push(tenantId);
      }
      if (tier) {
        filters.push(`tier = $${paramIndex++}`);
        params.push(tier);
      }
      if (status) {
        filters.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      
      const result = await pool.query(`
        SELECT 
          id, name, creature, emoji, description,
          tier, status, model, skills, config,
          owner_id as "ownerId",
          tenant_id as "tenantId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM agents
        WHERE ${filters.join(' AND ')}
        ORDER BY name ASC
      `, params);
      
      agents = result.rows.map(row => ({
        ...row,
        skills: row.skills || [],
        config: row.config || {},
      }));
    } catch (dbError) {
      console.warn('Using mock agents, DB error:', dbError);
      // Fallback to mock data
      agents = [
        { id: '1', name: 'CEO', creature: 'Phoenix', emoji: '👔', description: 'Executive leadership', tier: 'core', status: 'idle', model: 'claude-sonnet-4-20250514', skills: ['strategy', 'leadership'], totalRuns: 145, avgQuality: 92 },
        { id: '2', name: 'CTO', creature: 'Dragon', emoji: '🔧', description: 'Technical leadership', tier: 'core', status: 'idle', model: 'claude-sonnet-4-20250514', skills: ['architecture', 'code-review'], totalRuns: 234, avgQuality: 89 },
        { id: '3', name: 'Security', creature: 'Eagle', emoji: '🔐', description: 'Security engineering', tier: 'venture', status: 'idle', model: 'claude-sonnet-4-20250514', skills: ['security-audit', 'compliance'], totalRuns: 89, avgQuality: 94 },
        { id: '4', name: 'BackendDev', creature: 'Wolf', emoji: '💾', description: 'Backend development', tier: 'venture', status: 'running', model: 'claude-sonnet-4-20250514', skills: ['nodejs', 'typescript', 'postgresql'], totalRuns: 312, avgQuality: 87 },
        { id: '5', name: 'FrontendDev', creature: 'Fox', emoji: '🎨', description: 'Frontend development', tier: 'venture', status: 'idle', model: 'claude-sonnet-4-20250514', skills: ['react', 'typescript', 'css'], totalRuns: 278, avgQuality: 85 },
        { id: '6', name: 'DataAnalyst', creature: 'Owl', emoji: '📊', description: 'Data analysis', tier: 'personal', status: 'idle', model: 'claude-3-5-haiku-20241022', skills: ['sql', 'python', 'visualization'], totalRuns: 156, avgQuality: 72 },
        { id: '7', name: 'InfraAnalyst', creature: 'Bear', emoji: '🏗️', description: 'Infrastructure analysis', tier: 'personal', status: 'idle', model: 'claude-sonnet-4-20250514', skills: ['infrastructure', 'ppp', 'finance'], totalRuns: 67, avgQuality: 96 },
      ];
    }
    
    // Return array directly (not wrapped)
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// ============================================
// TEMPLATES - Returns Template[] directly
// ============================================
router.get('/templates', extractUser, async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    // Mock data (replace with DB query when tables exist)
    let templates = [
      { id: '1', name: 'Infrastructure Analyst', slug: 'infrastructure-analyst', category: 'rebelgroup', icon: '🏗️', description: 'Analyzes infrastructure projects, PPP structures, and transport systems', usageCount: 45 },
      { id: '2', name: 'Energy Transition Advisor', slug: 'energy-transition-advisor', category: 'rebelgroup', icon: '⚡', description: 'Advises on renewable energy, decarbonization strategies', usageCount: 38 },
      { id: '3', name: 'Water Sector Specialist', slug: 'water-specialist', category: 'rebelgroup', icon: '💧', description: 'Expert in water resource management and sanitation', usageCount: 22 },
      { id: '4', name: 'Health Systems Analyst', slug: 'health-systems-analyst', category: 'rebelgroup', icon: '🏥', description: 'Analyzes health systems and social protection', usageCount: 31 },
      { id: '5', name: 'Content Creator', slug: 'content-creator', category: 'entertainment', icon: '🎬', description: 'Creates engaging content for media productions', usageCount: 89 },
      { id: '6', name: 'Event Planner', slug: 'event-planner', category: 'entertainment', icon: '🎉', description: 'Plans and coordinates entertainment events', usageCount: 56 },
      { id: '7', name: 'Travel Advisor', slug: 'travel-advisor', category: 'travel', icon: '✈️', description: 'Expert travel planning and recommendations', usageCount: 134 },
      { id: '8', name: 'Destination Expert', slug: 'destination-expert', category: 'travel', icon: '🗺️', description: 'In-depth knowledge of global destinations', usageCount: 78 },
      { id: '9', name: 'Strategy Consultant', slug: 'strategy-consultant', category: 'services', icon: '🎯', description: 'Develops strategies, policies, and roadmaps', usageCount: 89 },
      { id: '10', name: 'Financial Analyst', slug: 'financial-analyst', category: 'services', icon: '💰', description: 'Financial modeling, valuations, and economic analysis', usageCount: 76 },
      { id: '11', name: 'Innovation Scout', slug: 'innovation-scout', category: 'innovation', icon: '💡', description: 'Identifies emerging technologies and trends', usageCount: 45 },
      { id: '12', name: 'Research Assistant', slug: 'research-assistant', category: 'innovation', icon: '🔍', description: 'Conducts desk research and literature reviews', usageCount: 156 },
    ];
    
    if (category && category !== 'all') {
      templates = templates.filter(t => t.category === category);
    }
    
    // Return array directly
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ============================================
// PROMPTS - Returns PromptsData { prompts, stats }
// ============================================
router.get('/prompts', extractUser, async (req: Request, res: Response) => {
  try {
    // Mock data
    const prompts = [
      { id: '1', name: 'SWOT Analysis', slug: 'swot-analysis', category: 'analysis', content: 'Perform a comprehensive SWOT analysis...', usageCount: 156, rating: 4.5, version: '2.1' },
      { id: '2', name: 'Cost-Benefit Analysis', slug: 'cost-benefit-analysis', category: 'analysis', content: 'Conduct a thorough cost-benefit analysis...', usageCount: 89, rating: 4.3, version: '1.8' },
      { id: '3', name: 'Strategic Options Assessment', slug: 'strategic-options', category: 'strategy', content: 'Evaluate strategic options considering...', usageCount: 67, rating: 4.7, version: '3.0' },
      { id: '4', name: 'Executive Summary', slug: 'executive-summary', category: 'writing', content: 'Write a concise executive summary...', usageCount: 234, rating: 4.6, version: '2.5' },
      { id: '5', name: 'Literature Review', slug: 'literature-review', category: 'research', content: 'Conduct a systematic literature review...', usageCount: 78, rating: 4.2, version: '1.5' },
      { id: '6', name: 'Quality Review', slug: 'quality-review', category: 'review', content: 'Review the document for quality...', usageCount: 112, rating: 4.4, version: '2.0' },
      { id: '7', name: 'Data Analysis Request', slug: 'data-analysis-request', category: 'data', content: 'Analyze the provided dataset...', usageCount: 95, rating: 4.1, version: '1.3' },
      { id: '8', name: 'Stakeholder Analysis', slug: 'stakeholder-analysis', category: 'analysis', content: 'Identify and analyze key stakeholders...', usageCount: 67, rating: 4.5, version: '1.9' },
      { id: '9', name: 'Risk Assessment', slug: 'risk-assessment', category: 'analysis', content: 'Perform a comprehensive risk assessment...', usageCount: 88, rating: 4.6, version: '2.2' },
    ];
    
    const stats = {
      totalPrompts: prompts.length,
      totalUses: prompts.reduce((sum, p) => sum + p.usageCount, 0),
      avgRating: prompts.reduce((sum, p) => sum + p.rating, 0) / prompts.length,
    };
    
    res.json({ prompts, stats });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// ============================================
// COSTS - Returns CostsData
// ============================================
router.get('/costs', extractUser, async (req: Request, res: Response) => {
  try {
    // Mock data
    const costsData = {
      budget: {
        totalBudget: 2000,
        spent: 1250,
        projected: 1850,
        remaining: 750,
      },
      tierBudgets: [
        { tier: 'core' as const, budget: 800, spent: 450 },
        { tier: 'venture' as const, budget: 800, spent: 550 },
        { tier: 'personal' as const, budget: 400, spent: 250 },
      ],
      modelCosts: [
        { model: 'Claude Sonnet', tier: 'core' as const, amount: 650, percentage: 52 },
        { model: 'Claude Haiku', tier: 'venture' as const, amount: 350, percentage: 28 },
        { model: 'GPT-4', tier: 'venture' as const, amount: 150, percentage: 12 },
        { model: 'Other', tier: 'personal' as const, amount: 100, percentage: 8 },
      ],
      dailySpend: [
        { day: 'Mon', amount: 165 },
        { day: 'Tue', amount: 189 },
        { day: 'Wed', amount: 210 },
        { day: 'Thu', amount: 178 },
        { day: 'Fri', amount: 195 },
        { day: 'Sat', amount: 145 },
        { day: 'Sun', amount: 168 },
      ],
    };
    
    res.json(costsData);
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

// ============================================
// DASHBOARD - Aggregated view
// ============================================
router.get('/dashboard', extractUser, async (req: Request, res: Response) => {
  try {
    const stats = {
      activeAgents: 12,
      activeAgentsTrend: 8,
      totalRunsToday: 347,
      totalRunsTrend: 15,
      avgQualityScore: 87,
      qualityTrend: 3,
      monthlySpend: 1250,
      spendTrend: -12,
    };

    const insights = [
      {
        id: 'ins-1',
        level: 'venture' as const,
        type: 'drift_warning' as const,
        title: 'Performance drift: DataAnalyst',
        description: 'Quality dropped from 85 to 72 over last 3 days. Consider prompt refresh.',
        confidence: 0.82,
        impactEstimate: 'medium' as const,
        status: 'detected' as const,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ins-2',
        level: 'rebel' as const,
        type: 'pattern' as const,
        title: 'High performer: InfraAnalyst',
        description: 'Personal agent with 96% quality score, 95% success rate. Ready for venture promotion.',
        confidence: 0.91,
        impactEstimate: 'high' as const,
        status: 'detected' as const,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    const budget = {
      coreTier: { used: 450, limit: 800 },
      ventureTier: { used: 550, limit: 800 },
      personalTier: { used: 250, limit: 400 },
    };

    const recentActivity = [
      { agent: 'BackendDev', action: 'Completed sprint REBAA-32', time: '2m ago', status: 'success' as const },
      { agent: 'FrontendDev', action: 'Started dashboard update', time: '5m ago', status: 'info' as const },
      { agent: 'DataAnalyst', action: 'Error: Token limit exceeded', time: '12m ago', status: 'error' as const },
      { agent: 'Security', action: 'Audit scan completed', time: '18m ago', status: 'success' as const },
      { agent: 'CTO', action: 'Approved template publish', time: '25m ago', status: 'success' as const },
    ];

    res.json({ stats, insights, budget, recentActivity });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================
// TELEMETRY INSIGHTS
// ============================================
router.get('/telemetry/insights', extractUser, async (req: Request, res: Response) => {
  try {
    const insights = [
      {
        id: 'ins-1',
        level: 'venture' as const,
        type: 'drift_warning' as const,
        title: 'Performance drift: DataAnalyst',
        description: 'Quality dropped from 85 to 72 over last 3 days. Consider prompt refresh.',
        confidence: 0.82,
        impactEstimate: 'medium' as const,
        status: 'detected' as const,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ins-2',
        level: 'rebel' as const,
        type: 'pattern' as const,
        title: 'High performer: InfraAnalyst',
        description: 'Personal agent with 96% quality score, 95% success rate. Ready for venture promotion.',
        confidence: 0.91,
        impactEstimate: 'high' as const,
        status: 'detected' as const,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'ins-3',
        level: 'individual' as const,
        type: 'optimization' as const,
        title: 'Token optimization: ReportWriter',
        description: 'High token usage (avg 45k) with moderate quality. Consider prompt streamlining.',
        confidence: 0.75,
        impactEstimate: 'low' as const,
        status: 'detected' as const,
        createdAt: new Date(Date.now() - 14400000).toISOString(),
      },
    ];

    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

export default router;
