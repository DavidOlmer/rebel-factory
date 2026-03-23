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
import { config } from './config/env';

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

// API routes (protected by auth middleware in each route)
app.use('/api/agents', agentRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/sharepoint', sharepointRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/audit', auditRoutes);

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
  - REST /api/agents
  - REST /api/sprints
  - REST /api/sharepoint/*
  - REST /api/tenants
  - REST /api/audit
  `);
});

export default app;
