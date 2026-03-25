{
  "code": "import { Log } from 'cloudflare:workers';
import { D1Database } from 'cloudflare:workers';

interface AuditLog {
  id: string;
  user_id: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  resource_type: 'agent' | 'venture' | 'session' | 'prompt';
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  timestamp: Date;
}

interface LogFilters {
  dateRange?: [Date, Date];
  userId?: string;
  action?: 'create' | 'read' | 'update' | 'delete' | 'execute';
}

const AUDIT_LOG_TABLE = 'audit_logs';

export default {
  async logAction(
    userId: string,
    action: 'create' | 'read' | 'update' | 'delete' | 'execute',
    resourceType: 'agent' | 'venture' | 'session' | 'prompt',
    resourceId: string,
    details: Record<string, unknown>,
    request: Request
  ): Promise<void> {
    const db: D1Database = await