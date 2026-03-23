import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cookieParser from 'cookie-parser';
import { initDatabase, healthCheck } from './db/client';
import { createAgentRoutes } from './routes/agents';
import { createSprintRoutes } from './routes/sprints';
import authRoutes from './routes/auth';
import sharepointRoutes from './routes/sharepoint';
import auditRoutes from './routes/audit';
import { extractUser, validateToken } from './middleware/auth';
import { correlationId, auditMiddleware } from './middleware/audit';
import type { WSMessage } from './types';

const PORT = parseInt(process.env.PORT || '3300', 10);

const app = express();
const server = createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

function broadcast(message: WSMessage): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(correlationId); // REBAA-27: Add correlation ID to all requests

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (_req, res) => {
  const dbHealthy = await healthCheck();
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (public)
app.use('/auth', authRoutes);

// Extract user for all API routes (optional auth)
app.use('/api', extractUser);

// REBAA-27: Audit middleware for mutation logging
app.use('/api', auditMiddleware);
app.use('/auth', auditMiddleware);

// API routes
app.use('/api/agents', createAgentRoutes(broadcast));
app.use('/api/sprints', createSprintRoutes(broadcast));
app.use('/api/sharepoint', sharepointRoutes);
app.use('/api/audit', auditRoutes); // REBAA-27: Audit query/export endpoints

// Protected API routes example
// app.use('/api/admin', validateToken, requireAdmin, adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Startup
async function start(): Promise<void> {
  try {
    console.log('🔌 Initializing database...');
    await initDatabase();
    
    server.listen(PORT, () => {
      console.log(`🚀 Rebel Factory Backend running on port ${PORT}`);
      console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
      console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

start();

export { app, server };
