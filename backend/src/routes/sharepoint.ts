/**
 * SharePoint API Routes
 * Provides REST endpoints for SharePoint/OneDrive operations
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SharePointService, SharePointError } from '../services/sharepoint.service';
import { validateToken } from '../middleware/auth';
import {
  SiteIdSchema,
  LibraryIdSchema,
  ItemIdSchema,
  ListFilesQuerySchema,
  UploadFileSchema,
  CreateFolderSchema,
} from '../types/sharepoint';

const router = Router();

// All SharePoint routes require authentication
router.use(validateToken);

/**
 * Helper to get user's access token from request
 */
function getUserToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No bearer token in authorization header');
  }
  return authHeader.slice(7);
}

/**
 * Helper to create SharePoint service from request
 */
async function getService(req: Request): Promise<SharePointService> {
  const token = getUserToken(req);
  return SharePointService.fromUserToken(token);
}

/**
 * Handle SharePoint errors consistently
 */
function handleError(error: unknown, res: Response, defaultMessage: string): void {
  console.error('SharePoint error:', error);

  if (error instanceof SharePointError) {
    if (error.isNotFound()) {
      res.status(404).json({ error: 'Not found', message: error.message });
      return;
    }
    if (error.isAccessDenied()) {
      res.status(403).json({ error: 'Access denied', message: error.message });
      return;
    }
    if (error.isConflict()) {
      res.status(409).json({ error: 'Conflict', message: error.message });
      return;
    }
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation failed', details: error.errors });
    return;
  }

  res.status(500).json({ error: defaultMessage });
}

/**
 * GET /api/sharepoint/sites
 * List all accessible SharePoint sites
 */
router.get('/sites', async (req: Request, res: Response) => {
  try {
    const service = await getService(req);
    const sites = await service.listSites();
    res.json({ data: sites, count: sites.length });
  } catch (error) {
    handleError(error, res, 'Failed to list sites');
  }
});

/**
 * GET /api/sharepoint/sites/search
 * Search for SharePoint sites
 */
router.get('/sites/search', async (req: Request, res: Response) => {
  try {
    const query = z.string().min(1).parse(req.query.q);
    const service = await getService(req);
    const sites = await service.searchSites(query);
    res.json({ data: sites, count: sites.length });
  } catch (error) {
    handleError(error, res, 'Failed to search sites');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId
 * Get a specific site
 */
router.get('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const service = await getService(req);
    const site = await service.getSite(siteId);
    res.json({ data: site });
  } catch (error) {
    handleError(error, res, 'Failed to get site');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries
 * List document libraries in a site
 */
router.get('/sites/:siteId/libraries', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const service = await getService(req);
    const libraries = await service.listLibraries(siteId);
    res.json({ data: libraries, count: libraries.length });
  } catch (error) {
    handleError(error, res, 'Failed to list libraries');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId
 * Get a specific library
 */
router.get('/sites/:siteId/libraries/:libraryId', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const service = await getService(req);
    const library = await service.getLibrary(siteId, libraryId);
    res.json({ data: library });
  } catch (error) {
    handleError(error, res, 'Failed to get library');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId/files
 * List files in a library
 * Query params: path, recursive, filter, top
 */
router.get('/sites/:siteId/libraries/:libraryId/files', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const query = ListFilesQuerySchema.parse(req.query);

    const service = await getService(req);
    const files = await service.listFiles(siteId, libraryId, query.path, {
      top: query.top,
      filter: query.filter,
    });

    res.json({ data: files, count: files.length });
  } catch (error) {
    handleError(error, res, 'Failed to list files');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId
 * Get a specific file/folder
 */
router.get('/sites/:siteId/libraries/:libraryId/files/:itemId', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const service = await getService(req);
    const item = await service.getItem(siteId, libraryId, itemId);

    res.json({ data: item });
  } catch (error) {
    handleError(error, res, 'Failed to get file');
  }
});

/**
 * POST /api/sharepoint/sites/:siteId/libraries/:libraryId/files
 * Upload a file
 * Body: multipart/form-data with 'file' field
 * Query: path (optional folder path), conflictBehavior
 */
router.post('/sites/:siteId/libraries/:libraryId/files', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);

    // Get upload parameters from query
    const { name, path, conflictBehavior } = UploadFileSchema.parse({
      name: req.query.name || req.headers['x-file-name'],
      path: req.query.path,
      conflictBehavior: req.query.conflictBehavior,
    });

    // Read file content from request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks);

    if (content.length === 0) {
      return res.status(400).json({ error: 'No file content provided' });
    }

    // Build full path
    const filePath = path ? `${path}/${name}` : `/${name}`;

    const service = await getService(req);
    const file = await service.uploadFile(siteId, libraryId, filePath, content, {
      conflictBehavior,
    });

    res.status(201).json({ data: file });
  } catch (error) {
    handleError(error, res, 'Failed to upload file');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId/download
 * Download a file
 */
router.get('/sites/:siteId/libraries/:libraryId/files/:itemId/download', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const service = await getService(req);

    // Get file metadata for filename
    const item = await service.getItem(siteId, libraryId, itemId);
    
    if (item.isFolder) {
      return res.status(400).json({ error: 'Cannot download a folder' });
    }

    // Download content
    const content = await service.downloadFile(siteId, libraryId, itemId);

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}"`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', content.length.toString());

    res.send(content);
  } catch (error) {
    handleError(error, res, 'Failed to download file');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId/url
 * Get a temporary download URL for a file
 */
router.get('/sites/:siteId/libraries/:libraryId/files/:itemId/url', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const service = await getService(req);
    const downloadUrl = await service.getDownloadUrl(siteId, libraryId, itemId);

    res.json({ data: { downloadUrl } });
  } catch (error) {
    handleError(error, res, 'Failed to get download URL');
  }
});

/**
 * POST /api/sharepoint/sites/:siteId/libraries/:libraryId/folders
 * Create a folder
 */
router.post('/sites/:siteId/libraries/:libraryId/folders', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const { name, parentPath } = CreateFolderSchema.parse(req.body);

    const service = await getService(req);
    const folder = await service.createFolder(siteId, libraryId, name, parentPath);

    res.status(201).json({ data: folder });
  } catch (error) {
    handleError(error, res, 'Failed to create folder');
  }
});

/**
 * DELETE /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId
 * Delete a file or folder
 */
router.delete('/sites/:siteId/libraries/:libraryId/files/:itemId', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const service = await getService(req);
    await service.deleteItem(siteId, libraryId, itemId);

    res.status(204).send();
  } catch (error) {
    handleError(error, res, 'Failed to delete item');
  }
});

/**
 * PATCH /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId/move
 * Move a file or folder
 */
router.patch('/sites/:siteId/libraries/:libraryId/files/:itemId/move', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const { newParentId, newName } = z.object({
      newParentId: z.string().min(1),
      newName: z.string().min(1).optional(),
    }).parse(req.body);

    const service = await getService(req);
    const item = await service.moveItem(siteId, libraryId, itemId, newParentId, newName);

    res.json({ data: item });
  } catch (error) {
    handleError(error, res, 'Failed to move item');
  }
});

/**
 * POST /api/sharepoint/sites/:siteId/libraries/:libraryId/files/:itemId/copy
 * Copy a file or folder
 */
router.post('/sites/:siteId/libraries/:libraryId/files/:itemId/copy', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const itemId = ItemIdSchema.parse(req.params.itemId);

    const { destinationParentId, newName } = z.object({
      destinationParentId: z.string().min(1),
      newName: z.string().min(1).optional(),
    }).parse(req.body);

    const service = await getService(req);
    const result = await service.copyItem(siteId, libraryId, itemId, destinationParentId, newName);

    res.status(202).json({ data: result });
  } catch (error) {
    handleError(error, res, 'Failed to copy item');
  }
});

/**
 * GET /api/sharepoint/sites/:siteId/libraries/:libraryId/search
 * Search for files in a library
 */
router.get('/sites/:siteId/libraries/:libraryId/search', async (req: Request, res: Response) => {
  try {
    const siteId = SiteIdSchema.parse(req.params.siteId);
    const libraryId = LibraryIdSchema.parse(req.params.libraryId);
    const query = z.string().min(1).parse(req.query.q);

    const service = await getService(req);
    const files = await service.searchFiles(siteId, libraryId, query);

    res.json({ data: files, count: files.length });
  } catch (error) {
    handleError(error, res, 'Failed to search files');
  }
});

export default router;
