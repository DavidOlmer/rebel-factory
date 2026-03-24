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
  `);
});

export default app;
