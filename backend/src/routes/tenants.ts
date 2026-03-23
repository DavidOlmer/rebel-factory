/**
 * Tenant Routes
 * REBAA-28: Multi-Tenant Architecture
 */
import { Router, Request, Response } from 'express';
import { validateToken, requireAdmin } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  getAllTenants,
  updateTenant,
  deleteTenant,
  shareAgent,
  revokeAgentShare,
  getAgentsSharedWithTenant,
  getAgentShares,
  isSlugAvailable,
  validateSlug,
} from '../services/tenant.service';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  ShareAgentRequestSchema,
} from '../types';

const router = Router();

// =============================================================================
// TENANT CRUD (Admin only)
// =============================================================================

/**
 * GET /api/tenants
 * List all tenants (admin only)
 */
router.get('/', validateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const tenants = await getAllTenants(true);
    res.json({ tenants });
  } catch (error) {
    console.error('Error listing tenants:', error);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

/**
 * POST /api/tenants
 * Create a new tenant (admin only)
 */
router.post('/', validateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = CreateTenantSchema.parse(req.body);
    
    // Validate slug format
    const slugValidation = validateSlug(data.slug);
    if (!slugValidation.valid) {
      res.status(400).json({ error: slugValidation.error });
      return;
    }
    
    // Check slug availability
    const available = await isSlugAvailable(data.slug);
    if (!available) {
      res.status(409).json({ error: `Slug "${data.slug}" is already taken` });
      return;
    }
    
    const tenant = await createTenant(data);
    res.status(201).json({ tenant });
  } catch (error) {
    if ((error as Error).name === 'ZodError') {
      res.status(400).json({ error: 'Invalid tenant data', details: error });
      return;
    }
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * GET /api/tenants/:id
 * Get tenant by ID
 */
router.get('/:id', validateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Allow lookup by slug or UUID
    const tenant = id.includes('-') 
      ? await getTenantById(id)
      : await getTenantBySlug(id);
    
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    
    res.json({ tenant });
  } catch (error) {
    console.error('Error getting tenant:', error);
    res.status(500).json({ error: 'Failed to get tenant' });
  }
});

/**
 * PUT /api/tenants/:id
 * Update tenant (admin only)
 */
router.put('/:id', validateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = UpdateTenantSchema.parse(req.body);
    
    // If updating slug, validate
    if (data.slug) {
      const slugValidation = validateSlug(data.slug);
      if (!slugValidation.valid) {
        res.status(400).json({ error: slugValidation.error });
        return;
      }
      
      const available = await isSlugAvailable(data.slug, id);
      if (!available) {
        res.status(409).json({ error: `Slug "${data.slug}" is already taken` });
        return;
      }
    }
    
    const tenant = await updateTenant(id, data);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    
    res.json({ tenant });
  } catch (error) {
    if ((error as Error).name === 'ZodError') {
      res.status(400).json({ error: 'Invalid tenant data', details: error });
      return;
    }
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

/**
 * DELETE /api/tenants/:id
 * Soft-delete tenant (admin only)
 */
router.delete('/:id', validateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteTenant(id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// =============================================================================
// CURRENT TENANT CONTEXT
// =============================================================================

/**
 * GET /api/tenants/me
 * Get current tenant (from middleware context)
 */
router.get('/me', requireTenant, (req: Request, res: Response) => {
  res.json({ tenant: req.tenant });
});

// =============================================================================
// AGENT SHARING
// =============================================================================

/**
 * POST /api/tenants/share-agent
 * Share an agent with another tenant
 */
router.post('/share-agent', validateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const data = ShareAgentRequestSchema.parse({
      ...req.body,
      sharedBy: req.user?.id,
    });
    
    // Verify the agent belongs to current tenant
    // (would need to import agent service and check)
    
    const share = await shareAgent(data);
    res.status(201).json({ share });
  } catch (error) {
    if ((error as Error).name === 'ZodError') {
      res.status(400).json({ error: 'Invalid share request', details: error });
      return;
    }
    console.error('Error sharing agent:', error);
    res.status(500).json({ error: 'Failed to share agent' });
  }
});

/**
 * DELETE /api/tenants/share-agent/:agentId/:tenantId
 * Revoke agent share
 */
router.delete('/share-agent/:agentId/:tenantId', validateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const { agentId, tenantId } = req.params;
    const revoked = await revokeAgentShare(agentId, tenantId);
    
    if (!revoked) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error revoking agent share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

/**
 * GET /api/tenants/shared-agents
 * Get agents shared with current tenant
 */
router.get('/shared-agents', validateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const shares = await getAgentsSharedWithTenant(req.tenantId!);
    res.json({ shares });
  } catch (error) {
    console.error('Error getting shared agents:', error);
    res.status(500).json({ error: 'Failed to get shared agents' });
  }
});

/**
 * GET /api/tenants/agent-shares/:agentId
 * Get all shares for an agent
 */
router.get('/agent-shares/:agentId', validateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const shares = await getAgentShares(agentId);
    res.json({ shares });
  } catch (error) {
    console.error('Error getting agent shares:', error);
    res.status(500).json({ error: 'Failed to get agent shares' });
  }
});

// =============================================================================
// SLUG VALIDATION
// =============================================================================

/**
 * GET /api/tenants/check-slug/:slug
 * Check if slug is available
 */
router.get('/check-slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const validation = validateSlug(slug);
    if (!validation.valid) {
      res.json({ available: false, error: validation.error });
      return;
    }
    
    const available = await isSlugAvailable(slug);
    res.json({ available });
  } catch (error) {
    console.error('Error checking slug:', error);
    res.status(500).json({ error: 'Failed to check slug' });
  }
});

export default router;
