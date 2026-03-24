/**
 * Rebel AI Factory - Enterprise Backend
 * 
 * Features:
 * - Microsoft SSO (Azure AD / Entra ID)
 * - SharePoint Integration
 * - Multi-tenant Architecture
 * - RBAC (Role-Based Access Control)
 * - Audit Logging
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config/env';

// Validate environment on startup
validateConfig();

// Middleware
import { extractUser } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { auditMiddleware } from './middleware/audit';

// Routes
import agentRoutes from './routes/agents';
import sprintRoutes from './routes/sprints';
import authRoutes from './routes/auth';
import sharepointRoutes from './routes/sharepoint';
import tenantRoutes from './routes/tenants';
import auditRoutes from './routes/audit';
import statsRoutes from './routes/stats';
import promptRoutes from './routes/prompts';
import telemetryRoutes from './routes/telemetry';
import frontendApiRoutes from './routes/frontend-api';
import templateRoutes from './routes/templates';
import { createScoutRoutes } from './routes/scouts';
import contextHealthRoutes from './routes/context-health';
import exceptionRoutes from './routes/exceptions';
import { createInstitutionalRoutes } from './routes/institutional';
import { createMemoryRoutes } from './routes/memory';
import observabilityRoutes from './routes/observability';
import sandboxRoutes from './routes/sandbox';
import credentialsRoutes from './routes/credentials';
import autonomousDecisionRoutes from './routes/autonomous-decision';
import codeExecutionRoutes from './routes/code-execution';
import { pool } from './db/client';

const app = express();

// Base middleware
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Auth extraction (populates req.user if token present)
app.use(extractUser);

// Tenant context
app.use(tenantMiddleware);

// Audit logging (for mutations)
app.use(auditMiddleware);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    enterprise: true,
    timestamp: new Date().toISOString()
  });
});

// Auth routes (public)
app.use('/auth', authRoutes);

// Frontend-facing API routes (return data in shapes expected by React components)
app.use('/api', frontendApiRoutes);

// API routes (protected by auth middleware in each route)
app.use('/api/agents-internal', agentRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/sharepoint', sharepointRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/agents', createScoutRoutes()); // Scout routes: /api/agents/:id/scout/*
app.use('/api/scouts', createScoutRoutes()); // Scout info: /api/scouts/types, /api/scouts/presets
app.use('/api', contextHealthRoutes); // Context Health: /api/agents/:id/context-health, /api/context-health/*
app.use('/api/exceptions', exceptionRoutes); // DIRA Exception Patterns: /api/exceptions/*
app.use('/api/institutional', createInstitutionalRoutes(pool)); // Institutional Intelligence: 7 Pillars Framework
app.use('/api/memory', createMemoryRoutes(() => {})); // Memory Consolidation: Episodic→Semantic transformation
app.use('/api/observability', observabilityRoutes); // LLM Observability + Quality Gate: traces, metrics, 4-stage review
app.use('/api/sandbox', sandboxRoutes); // Agent Sandboxing: secure execution boundaries
app.use('/api/credentials', credentialsRoutes); // Credential Isolation: per-agent credential storage
app.use('/api/autonomous', autonomousDecisionRoutes); // Autonomous Decision: when to act vs escalate
app.use('/api/execute', codeExecutionRoutes); // Code Execution: sandboxed code runner

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.env === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`
  🏭 Rebel AI Factory - Enterprise Edition
  
  Environment:  ${config.env}
  Port:         ${config.port}
  Frontend:     ${config.frontend.url}
  Azure Tenant: ${config.azure.tenantId || '(not configured)'}
  
  Endpoints:
  - GET  /api/health
  - GET  /auth/login
  - GET  /auth/callback
  - GET  /auth/logout
  - GET  /auth/me
  - GET  /api/dashboard     (frontend)
  - GET  /api/agents        (frontend)
  - GET  /api/templates     (frontend)
  - GET  /api/costs         (frontend)
  - REST /api/sprints
  - REST /api/sharepoint/*
  - REST /api/tenants
  - REST /api/audit
  - GET  /api/stats/*
  - REST /api/prompts       (REBAA-33: Prompt Library)
  - REST /api/telemetry/*   (REBAA-34: Telemetry & Insights)
  - REST /api/templates     (REBAA-21: Agent Templates)
  - POST /api/agents/:id/scout (Scout System - parallel analysis)
  - GET  /api/scouts/types     (Available scout types)
  - GET  /api/scouts/presets   (Scout presets)
  - GET  /api/agents/:id/context-health       (Context Health analysis)
  - POST /api/agents/:id/context-health/reset (Clear poisoned context)
  - GET  /api/context-health/overview         (System-wide health)
  - GET  /api/exceptions/patterns             (DIRA: Discovered patterns)
  - GET  /api/exceptions/insights             (DIRA: Exception insights)
  - POST /api/exceptions/:id/resolve          (DIRA: Auto-resolve exception)
  - POST /api/exceptions/discover             (DIRA: Trigger pattern discovery)
  - GET  /api/exceptions/stats                (DIRA: Pattern statistics)
  - GET  /api/institutional/assess/:tenantId  (7 Pillars: Full assessment)
  - GET  /api/institutional/quick/:tenantId   (7 Pillars: Quick health check)
  - GET  /api/institutional/history/:tenantId (7 Pillars: Trend history)
  - GET  /api/institutional/pillar/:tenantId/:pillar (7 Pillars: Single pillar detail)
  - GET  /api/institutional/recommendations/:tenantId (7 Pillars: Prioritized actions)
  - POST /api/institutional/benchmark/:tenantId (7 Pillars: Industry comparison)
  - GET  /api/institutional/summary           (7 Pillars: Multi-tenant admin view)
  - GET  /api/institutional/export/:tenantId  (7 Pillars: Export report)
  - POST /api/memory/:agentId/episodic        (Memory: Add episodic memory)
  - POST /api/memory/:agentId/consolidate     (Memory: Run consolidation)
  - POST /api/memory/consolidate-all          (Memory: Batch consolidation)
  - GET  /api/memory/:agentId/patterns        (Memory: Get consolidated patterns)
  - POST /api/memory/:agentId/retrieve        (Memory: Semantic search)
  - GET  /api/memory/:agentId/stats           (Memory: Agent stats)
  - GET  /api/memory/overview                 (Memory: System overview)
  - POST /api/sandbox                         (Sandbox: Create agent sandbox)
  - GET  /api/sandbox/:agentId                (Sandbox: Get config)
  - POST /api/sandbox/:agentId/execute        (Sandbox: Execute code)
  - GET  /api/sandbox/:agentId/tools/:tool    (Sandbox: Check tool permission)
  - GET  /api/sandbox/:agentId/network/:level (Sandbox: Check network access)
  - POST /api/credentials/:agentId            (Credentials: Store credential)
  - GET  /api/credentials/:agentId            (Credentials: List credentials)
  - GET  /api/credentials/:agentId/:name      (Credentials: Get credential)
  - POST /api/credentials/:agentId/rotate     (Credentials: Rotate all)
  - GET  /api/credentials/:agentId/log        (Credentials: Access log)
  - POST /api/autonomous/decide               (Autonomous: Make decision for context)
  - POST /api/autonomous/decide/batch         (Autonomous: Batch decisions)
  - POST /api/autonomous/should-continue      (Autonomous: Check if should continue)
  - GET  /api/autonomous/policies             (Autonomous: List agent policies)
  - POST /api/autonomous/policies             (Autonomous: Create/update policy)
  - GET  /api/autonomous/history              (Autonomous: Decision history)
  - GET  /api/autonomous/stats                (Autonomous: Decision statistics)
  - POST /api/execute/execute                 (Execute: Run sandboxed code)
  - POST /api/execute/validate                (Execute: Validate code)
  - GET  /api/execute/running                 (Execute: List running executions)
  - POST /api/execute/kill/:id                (Execute: Kill execution)
  - GET  /api/execute/metrics                 (Execute: Execution metrics)
  - GET  /api/execute/languages               (Execute: Supported languages)
  - POST /api/execute/execute/quick           (Execute: Quick execution)
  - POST /api/execute/execute/repl            (Execute: REPL-style execution)
  `);
});

export default app;
