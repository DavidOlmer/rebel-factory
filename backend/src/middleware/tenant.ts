/**
 * Tenant Context Middleware
 * REBAA-28: Multi-Tenant Architecture
 * 
 * Extract tenant from:
 * 1. Subdomain (venture1.factory.rebelgroup.com)
 * 2. Header (X-Tenant-ID)
 * 3. JWT claim (tenant_id)
 */
import { Request, Response, NextFunction } from 'express';
import { getTenantById, getTenantBySlug, getTenantByAzureTenant } from '../services/tenant.service';
import type { Tenant } from '../types';

// Extend Express Request type for tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
    }
  }
}

// Configuration
const TENANT_HEADER = 'X-Tenant-ID';
const BASE_DOMAINS = [
  'factory.rebelgroup.com',
  'localhost',
  '127.0.0.1',
];

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check against base domains
  for (const baseDomain of BASE_DOMAINS) {
    if (host.endsWith(baseDomain)) {
      const subdomain = host.slice(0, -(baseDomain.length + 1)); // +1 for the dot
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }
  }
  
  return null;
}

/**
 * Extract tenant identifier from request
 * Priority: Header > JWT claim > Subdomain
 */
function extractTenantIdentifier(req: Request): { type: 'id' | 'slug' | 'azure'; value: string } | null {
  // 1. Check X-Tenant-ID header (direct UUID or slug)
  const headerValue = req.headers[TENANT_HEADER.toLowerCase()] as string;
  if (headerValue) {
    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(headerValue)) {
      return { type: 'id', value: headerValue };
    }
    return { type: 'slug', value: headerValue };
  }

  // 2. Check JWT claim (if user is authenticated)
  if (req.user) {
    // Check for direct tenant_id claim
    const jwtTenantId = (req.user as unknown as { tenant_id?: string }).tenant_id;
    if (jwtTenantId) {
      return { type: 'id', value: jwtTenantId };
    }
    
    // Check for Azure tenant ID (from MSAL)
    const azureTenantId = (req.user as unknown as { tid?: string }).tid;
    if (azureTenantId) {
      return { type: 'azure', value: azureTenantId };
    }
  }

  // 3. Check subdomain
  const hostname = req.hostname || req.headers.host || '';
  const subdomain = extractSubdomain(hostname);
  if (subdomain) {
    return { type: 'slug', value: subdomain };
  }

  return null;
}

/**
 * Tenant middleware - extracts and validates tenant context
 * Sets req.tenant and req.tenantId if valid tenant found
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const identifier = extractTenantIdentifier(req);
    
    if (!identifier) {
      // No tenant context - might be OK for public routes
      next();
      return;
    }

    let tenant: Tenant | null = null;

    switch (identifier.type) {
      case 'id':
        tenant = await getTenantById(identifier.value);
        break;
      case 'slug':
        tenant = await getTenantBySlug(identifier.value);
        break;
      case 'azure':
        tenant = await getTenantByAzureTenant(identifier.value);
        break;
    }

    if (tenant) {
      // Check tenant status
      if (tenant.status !== 'active') {
        res.status(403).json({
          error: 'Tenant suspended',
          message: `Tenant "${tenant.name}" is currently ${tenant.status}`,
        });
        return;
      }

      req.tenant = tenant;
      req.tenantId = tenant.id;
    }

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    next(error);
  }
}

/**
 * Require tenant context middleware
 * Returns 400 if no valid tenant in request
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenant) {
    res.status(400).json({
      error: 'Tenant required',
      message: 'This endpoint requires a valid tenant context. ' +
               'Provide tenant via subdomain, X-Tenant-ID header, or JWT claim.',
    });
    return;
  }
  next();
}

/**
 * Require specific tenant (by ID or slug)
 * Useful for admin routes that operate on a specific tenant
 */
export function requireSpecificTenant(tenantIdOrSlug: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(400).json({
        error: 'Tenant required',
        message: 'No tenant context found',
      });
      return;
    }

    if (req.tenant.id !== tenantIdOrSlug && req.tenant.slug !== tenantIdOrSlug) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this tenant',
      });
      return;
    }

    next();
  };
}

/**
 * Get tenant from request (helper for services)
 */
export function getTenantFromRequest(req: Request): Tenant | null {
  return req.tenant || null;
}

/**
 * Get tenant ID from request (helper for queries)
 */
export function getTenantIdFromRequest(req: Request): string | null {
  return req.tenantId || null;
}
