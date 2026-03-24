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
  `);
});

export default app;
