/**
 * REBAA-27: Audit Middleware
 * Automatically logs all API mutations with before/after state tracking
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../services/audit.service';
import { AuditActions, ResourceTypes, AuditEntry } from '../types/audit';

// =============================================================================
// TYPES
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      auditContext?: {
        resourceType: string;
        resourceId?: string;
        action?: string;
        beforeState?: Record<string, unknown>;
        skipAudit?: boolean;
      };
    }
    interface Response {
      auditAfterState?: Record<string, unknown>;
    }
  }
}

// HTTP method to action mapping
const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// Route patterns to resource types
const ROUTE_RESOURCE_MAP: Array<{
  pattern: RegExp;
  resourceType: string;
  getResourceId?: (match: RegExpMatchArray) => string | undefined;
}> = [
  {
    pattern: /^\/api\/agents\/([^/]+)$/,
    resourceType: ResourceTypes.AGENT,
    getResourceId: (m) => m[1],
  },
  {
    pattern: /^\/api\/agents\/?$/,
    resourceType: ResourceTypes.AGENT,
  },
  {
    pattern: /^\/api\/sprints\/([^/]+)$/,
    resourceType: ResourceTypes.SPRINT,
    getResourceId: (m) => m[1],
  },
  {
    pattern: /^\/api\/sprints\/?$/,
    resourceType: ResourceTypes.SPRINT,
  },
  {
    pattern: /^\/api\/tenants\/([^/]+)$/,
    resourceType: ResourceTypes.TENANT,
    getResourceId: (m) => m[1],
  },
  {
    pattern: /^\/api\/tenants\/?$/,
    resourceType: ResourceTypes.TENANT,
  },
  {
    pattern: /^\/api\/settings\/?/,
    resourceType: ResourceTypes.SETTINGS,
  },
  {
    pattern: /^\/api\/files?\/([^/]+)?$/,
    resourceType: ResourceTypes.FILE,
    getResourceId: (m) => m[1],
  },
  {
    pattern: /^\/auth\//,
    resourceType: ResourceTypes.USER,
  },
];

// Actions that should be logged (mutations only by default)
const AUDITABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Correlation ID middleware - adds unique ID to each request
 */
export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  next();
}

/**
 * Get real client IP address
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

/**
 * Match request path to resource type
 */
function matchRoute(path: string): { resourceType: string; resourceId?: string } | null {
  for (const route of ROUTE_RESOURCE_MAP) {
    const match = path.match(route.pattern);
    if (match) {
      return {
        resourceType: route.resourceType,
        resourceId: route.getResourceId?.(match),
      };
    }
  }
  return null;
}

/**
 * Determine the audit action from request context
 */
function determineAction(
  method: string,
  path: string,
  resourceType: string
): string {
  // Special case for auth routes
  if (path.includes('/auth/login')) return AuditActions.USER_LOGIN;
  if (path.includes('/auth/logout')) return AuditActions.USER_LOGOUT;
  if (path.includes('/auth/register')) return AuditActions.USER_REGISTER;

  // Special cases for sprint completion
  if (resourceType === ResourceTypes.SPRINT && path.includes('/complete')) {
    return AuditActions.SPRINT_COMPLETE;
  }

  // Standard CRUD actions
  const baseAction = METHOD_ACTION_MAP[method] || 'unknown';
  return `${resourceType}.${baseAction}`;
}

/**
 * Main audit middleware - captures before state and logs after response
 */
export function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip non-mutation requests by default
  if (!AUDITABLE_METHODS.has(req.method)) {
    return next();
  }

  // Match route to resource type
  const routeMatch = matchRoute(req.path);
  if (!routeMatch) {
    return next();
  }

  // Set up audit context
  const correlationId = req.correlationId || uuidv4();
  req.correlationId = correlationId;
  req.auditContext = {
    resourceType: routeMatch.resourceType,
    resourceId: routeMatch.resourceId,
    action: determineAction(req.method, req.path, routeMatch.resourceType),
  };

  // Capture original response methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody: unknown;

  // Override json to capture response
  res.json = (body: unknown): Response => {
    responseBody = body;
    return originalJson(body);
  };

  // Override send for non-JSON responses
  res.send = (body: unknown): Response => {
    if (typeof body === 'string') {
      try {
        responseBody = JSON.parse(body);
      } catch {
        responseBody = body;
      }
    } else {
      responseBody = body;
    }
    return originalSend(body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    // Skip if audit was explicitly disabled
    if (req.auditContext?.skipAudit) return;

    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    try {
      const entry: AuditEntry = {
        // Who
        userId: req.user?.id,
        userEmail: req.user?.email,
        tenantId: req.user?.tenantId,

        // What
        action: req.auditContext?.action || `${routeMatch.resourceType}.${req.method.toLowerCase()}`,
        resourceType: routeMatch.resourceType,
        resourceId: req.auditContext?.resourceId || getResourceIdFromResponse(responseBody),

        // Context
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        correlationId,
        requestMethod: req.method,
        requestPath: req.path,

        // State
        beforeState: req.auditContext?.beforeState,
        afterState: success && responseBody ? sanitizeForAudit(responseBody) : undefined,
        metadata: {
          statusCode: res.statusCode,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          bodyKeys: req.body ? Object.keys(req.body) : undefined,
        },

        // Status
        success,
        errorMessage: !success && responseBody 
          ? (responseBody as { error?: string; message?: string })?.error || 
            (responseBody as { message?: string })?.message 
          : undefined,
      };

      await AuditService.log(entry);
    } catch (error) {
      // Don't let audit failures break the request
      console.error('[Audit] Failed to log:', error);
    }
  });

  next();
}

/**
 * Extract resource ID from response body
 */
function getResourceIdFromResponse(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const obj = body as Record<string, unknown>;
  return obj.id as string || undefined;
}

/**
 * Sanitize response data for audit logging (remove sensitive fields)
 */
function sanitizeForAudit(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const sensitiveFields = new Set([
    'password',
    'passwordHash',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'privateKey',
    'credentials',
  ]);

  function sanitize(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.has(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = sanitize(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return sanitize(data) as Record<string, unknown>;
}

// =============================================================================
// HELPER FUNCTIONS FOR ROUTES
// =============================================================================

/**
 * Set before state for update/delete operations
 * Call this after fetching the current resource state
 */
export function setAuditBeforeState(req: Request, state: Record<string, unknown>): void {
  if (req.auditContext) {
    req.auditContext.beforeState = sanitizeForAudit(state);
  }
}

/**
 * Set custom resource ID (when not available from URL)
 */
export function setAuditResourceId(req: Request, resourceId: string): void {
  if (req.auditContext) {
    req.auditContext.resourceId = resourceId;
  }
}

/**
 * Set custom action (override auto-detected action)
 */
export function setAuditAction(req: Request, action: string): void {
  if (req.auditContext) {
    req.auditContext.action = action;
  }
}

/**
 * Skip audit logging for this request
 */
export function skipAudit(req: Request): void {
  if (req.auditContext) {
    req.auditContext.skipAudit = true;
  }
}

/**
 * Manual audit logging (for non-HTTP events)
 */
export async function logAuditEvent(
  action: string,
  resourceType: string,
  options: {
    resourceId?: string;
    userId?: string;
    userEmail?: string;
    tenantId?: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<void> {
  await AuditService.log({
    action,
    resourceType,
    ...options,
    success: options.success ?? true,
  });
}

export default auditMiddleware;
