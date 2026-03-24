/**
 * REBEL AI FACTORY - All-in-One Server
 * 
 * Features:
 * - Agent Management
 * - Template Library
 * - Prompt Library
 * - Telemetry & Self-Learning
 * - Approval Flows
 * - Teams Integration
 * - Cost Tracking
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ============================================
// MOCK DATA
// ============================================

const TEMPLATES = [
  { id: '1', name: 'Infrastructure Analyst', slug: 'infrastructure-analyst', category: 'sector', subcategory: 'infrastructure', icon: '🏗️', description: 'Analyzes infrastructure projects, PPP structures, and transport systems', usageCount: 45 },
  { id: '2', name: 'Energy Transition Advisor', slug: 'energy-transition-advisor', category: 'sector', subcategory: 'energy', icon: '⚡', description: 'Advises on renewable energy, decarbonization strategies', usageCount: 38 },
  { id: '3', name: 'Water Sector Specialist', slug: 'water-specialist', category: 'sector', subcategory: 'water', icon: '💧', description: 'Expert in water resource management and sanitation', usageCount: 22 },
  { id: '4', name: 'Health Systems Analyst', slug: 'health-systems-analyst', category: 'sector', subcategory: 'health', icon: '🏥', description: 'Analyzes health systems and social protection', usageCount: 31 },
  { id: '5', name: 'Strategy Consultant', slug: 'strategy-consultant', category: 'service', subcategory: 'strategy', icon: '🎯', description: 'Develops strategies, policies, and roadmaps', usageCount: 89 },
  { id: '6', name: 'Financial Analyst', slug: 'financial-analyst', category: 'service', subcategory: 'finance', icon: '💰', description: 'Financial modeling, valuations, and economic analysis', usageCount: 76 },
  { id: '7', name: 'M&E Specialist', slug: 'monitoring-evaluation-specialist', category: 'service', subcategory: 'evaluation', icon: '📊', description: 'Designs monitoring frameworks and evaluations', usageCount: 54 },
  { id: '8', name: 'Research Assistant', slug: 'research-assistant', category: 'general', subcategory: 'research', icon: '🔍', description: 'Conducts desk research and literature reviews', usageCount: 156 },
  { id: '9', name: 'Report Writer', slug: 'report-writer', category: 'general', subcategory: 'writing', icon: '✍️', description: 'Writes professional reports and documentation', usageCount: 134 },
  { id: '10', name: 'Data Analyst', slug: 'data-analyst', category: 'general', subcategory: 'analytics', icon: '📈', description: 'Analyzes data and creates visualizations', usageCount: 98 },
];

const PROMPTS = [
  { id: '1', name: 'SWOT Analysis', slug: 'swot-analysis', category: 'analysis', usageCount: 156, avgRating: 4.5 },
  { id: '2', name: 'Cost-Benefit Analysis', slug: 'cost-benefit-analysis', category: 'analysis', usageCount: 89, avgRating: 4.3 },
  { id: '3', name: 'Strategic Options Assessment', slug: 'strategic-options', category: 'strategy', usageCount: 67, avgRating: 4.7 },
  { id: '4', name: 'Executive Summary', slug: 'executive-summary', category: 'writing', usageCount: 234, avgRating: 4.6 },
  { id: '5', name: 'Literature Review', slug: 'literature-review', category: 'research', usageCount: 78, avgRating: 4.2 },
  { id: '6', name: 'Quality Review', slug: 'quality-review', category: 'review', usageCount: 112, avgRating: 4.4 },
  { id: '7', name: 'Data Analysis Request', slug: 'data-analysis-request', category: 'data', usageCount: 95, avgRating: 4.1 },
];

const AGENTS = [
  { id: '1', name: 'CEO', icon: '👔', role: 'Executive', tier: 'core', status: 'idle', totalRuns: 145, avgQuality: 92 },
  { id: '2', name: 'CTO', icon: '🔧', role: 'Technical', tier: 'core', status: 'idle', totalRuns: 234, avgQuality: 89 },
  { id: '3', name: 'Security', icon: '🔐', role: 'Engineer', tier: 'venture', status: 'idle', totalRuns: 89, avgQuality: 94 },
  { id: '4', name: 'BackendDev', icon: '💾', role: 'Engineer', tier: 'venture', status: 'running', totalRuns: 312, avgQuality: 87 },
  { id: '5', name: 'FrontendDev', icon: '🎨', role: 'Engineer', tier: 'venture', status: 'idle', totalRuns: 278, avgQuality: 85 },
  { id: '6', name: 'DataAnalyst', icon: '📊', role: 'Analyst', tier: 'personal', status: 'idle', totalRuns: 156, avgQuality: 72 },
  { id: '7', name: 'InfraAnalyst', icon: '🏗️', role: 'Analyst', tier: 'personal', status: 'idle', totalRuns: 67, avgQuality: 96 },
];

const INSIGHTS = [
  { id: 'ins-1', level: 'venture', type: 'drift_warning', title: 'Performance drift: DataAnalyst', description: 'Quality dropped from 85 to 72 over last 3 days. Consider prompt refresh.', confidence: 0.82, impactEstimate: 'medium', status: 'detected' },
  { id: 'ins-2', level: 'rebel', type: 'pattern', title: 'High performer: InfraAnalyst', description: 'Personal agent with 96% quality score, 95% success rate. Ready for venture promotion.', confidence: 0.91, impactEstimate: 'high', status: 'detected' },
  { id: 'ins-3', level: 'individual', type: 'optimization', title: 'Token optimization: ReportWriter', description: 'High token usage (avg 45k) with moderate quality. Consider prompt streamlining.', confidence: 0.75, impactEstimate: 'low', status: 'detected' },
];

const APPROVALS = [
  { id: 'apr-1', type: 'agent_promotion', title: 'Promote "InfraAnalyst" to venture', requesterName: 'Jan de Vries', status: 'pending', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'apr-2', type: 'template_publish', title: 'Publish "Climate Finance Advisor" template', requesterName: 'Maria Santos', status: 'pending', createdAt: new Date(Date.now() - 7200000).toISOString() },
];

// ============================================
// ROUTES
// ============================================

const routes = {
  'GET /': () => ({ redirect: '/standalone.html' }),
  
  'GET /api/health': () => ({
    status: 'ok',
    version: '2.0.0',
    features: ['agents', 'templates', 'prompts', 'telemetry', 'approvals', 'teams', 'self-learning'],
    timestamp: new Date().toISOString()
  }),
  
  // Stats
  'GET /api/stats': () => ({
    agents: { total: AGENTS.length, idle: AGENTS.filter(a => a.status === 'idle').length, running: AGENTS.filter(a => a.status === 'running').length },
    issues: { total: 32, done: 23, open: 9 },
    templates: { total: TEMPLATES.length },
    prompts: { total: PROMPTS.length },
    tokens: { thisMonth: 125000000, budget: 200000000 }
  }),
  
  // Agents
  'GET /api/agents': () => ({ agents: AGENTS }),
  
  // Templates
  'GET /api/templates': () => ({ templates: TEMPLATES }),
  'GET /api/templates/categories': () => ({
    categories: [
      { id: 'sector', name: 'Sector', count: 4 },
      { id: 'service', name: 'Service', count: 3 },
      { id: 'general', name: 'General', count: 3 }
    ]
  }),
  
  // Prompts
  'GET /api/prompts': () => ({ prompts: PROMPTS }),
  'GET /api/prompts/categories': () => ({
    categories: ['analysis', 'strategy', 'writing', 'research', 'review', 'data']
  }),
  
  // Telemetry
  'GET /api/telemetry/dashboard': () => ({
    overview: {
      totalTenants: 5,
      totalAgents: 45,
      totalTokens: 847500000,
      totalRuns: 12456,
      avgQuality: 86.5,
      successRate: 94.2
    },
    trends: [
      { date: '2026-03-17', runs: 234, tokens: 12500000, quality: 85 },
      { date: '2026-03-18', runs: 287, tokens: 14200000, quality: 87 },
      { date: '2026-03-19', runs: 312, tokens: 15800000, quality: 84 },
      { date: '2026-03-20', runs: 298, tokens: 14900000, quality: 88 },
      { date: '2026-03-21', runs: 345, tokens: 17200000, quality: 86 },
      { date: '2026-03-22', runs: 367, tokens: 18100000, quality: 89 },
      { date: '2026-03-23', runs: 289, tokens: 14500000, quality: 87 }
    ],
    topAgents: AGENTS.slice(0, 5).map(a => ({ ...a, totalTokens: Math.floor(Math.random() * 5000000) }))
  }),
  
  'GET /api/telemetry/insights': () => ({ insights: INSIGHTS }),
  
  // Approvals
  'GET /api/approvals/pending': () => ({ approvals: APPROVALS }),
  
  // Costs
  'GET /api/costs/summary': () => ({
    currentMonth: {
      totalCost: 1250.45,
      totalTokens: 125000000,
      byModel: {
        'claude-sonnet-4-20250514': { tokens: 100000000, cost: 950.30 },
        'claude-3-5-haiku-20241022': { tokens: 25000000, cost: 300.15 }
      },
      byTier: {
        core: { tokens: 45000000, cost: 450 },
        venture: { tokens: 55000000, cost: 550 },
        personal: { tokens: 25000000, cost: 250 }
      }
    },
    budget: {
      monthly: 2000,
      used: 1250.45,
      percentUsed: 62.5,
      projectedEnd: 2100
    },
    trend: [
      { month: '2026-01', cost: 980 },
      { month: '2026-02', cost: 1120 },
      { month: '2026-03', cost: 1250 }
    ]
  }),
  
  // Sprints (legacy compatibility)
  'GET /api/sprints': () => ({
    sprints: [
      { identifier: 'REBAA-29', title: 'Enterprise Admin Dashboard', status: 'done', swe_stage: 'SHIP' },
      { identifier: 'REBAA-28', title: 'Multi-Tenant Architecture', status: 'done', swe_stage: 'SHIP' },
      { identifier: 'REBAA-27', title: 'Enterprise Audit Logging', status: 'done', swe_stage: 'SHIP' },
      { identifier: 'REBAA-30', title: 'Telemetry & Self-Learning', status: 'in_progress', swe_stage: 'BUILD' },
      { identifier: 'REBAA-31', title: 'Prompt Library', status: 'in_progress', swe_stage: 'BUILD' },
    ]
  }),
  
  // Auth
  'GET /auth/me': () => ({
    user: {
      id: 'dev-user-001',
      email: 'david@rebelgroup.com',
      name: 'David (Dev Mode)',
      role: 'admin',
      tenantId: 'rebel-ai-ventures'
    }
  })
};

// ============================================
// SERVER
// ============================================

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const key = `${req.method} ${req.url.split('?')[0]}`;
  
  // API routes
  if (routes[key]) {
    try {
      const data = routes[key]();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  
  // Static files
  let filePath = path.join(__dirname, 'frontend', req.url === '/' ? 'standalone.html' : req.url);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };
    
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  
  // Default: serve standalone.html
  const defaultFile = path.join(__dirname, 'frontend', 'standalone.html');
  if (fs.existsSync(defaultFile)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(defaultFile).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🏭 REBEL AI FACTORY                        ║
║                     Enterprise Edition v2.0                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                               ║
║  URL: http://localhost:${PORT}                                  ║
║  Mode: ${process.env.NODE_ENV || 'development'}                                           ║
║                                                               ║
║  Features:                                                    ║
║  ✓ Agent Management (${AGENTS.length} agents)                            ║
║  ✓ Template Library (${TEMPLATES.length} templates)                        ║
║  ✓ Prompt Library (${PROMPTS.length} prompts)                            ║
║  ✓ Telemetry & Self-Learning                                 ║
║  ✓ Approval Flows                                            ║
║  ✓ Cost Tracking                                             ║
║                                                               ║
║  API: /api/health, /api/agents, /api/templates, etc.         ║
║                                                               ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
