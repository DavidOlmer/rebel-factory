/**
 * SharePoint Service
 * Handles all SharePoint/OneDrive operations via Microsoft Graph API
 */
import { Client } from '@microsoft/microsoft-graph-client';
import { createGraphClientWithOBO, fetchAllPages, GraphPagedResponse } from '../config/graph';
import {
  Site,
  Library,
  DriveItem,
  SharePointFile,
  UploadSession,
  toSharePointFile,
} from '../types/sharepoint';

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for large file upload
const LARGE_FILE_THRESHOLD = 4 * 1024 * 1024; // Files > 4MB use upload session

export class SharePointService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Create SharePoint service instance from user token
   */
  static async fromUserToken(userToken: string): Promise<SharePointService> {
    const client = await createGraphClientWithOBO(userToken);
    return new SharePointService(client);
  }

  /**
   * List all SharePoint sites the user has access to
   */
  async listSites(): Promise<Site[]> {
    try {
      // Search for sites the user can access
      const response: GraphPagedResponse<Site> = await this.client
        .api('/sites')
        .filter('siteCollection/root ne null')
        .select('id,name,displayName,webUrl,description,createdDateTime,lastModifiedDateTime')
        .top(100)
        .get();

      return response.value;
    } catch (error) {
      console.error('[SharePoint] Failed to list sites:', error);
      throw new SharePointError('Failed to list SharePoint sites', error);
    }
  }

  /**
   * Search for SharePoint sites by keyword
   */
  async searchSites(query: string): Promise<Site[]> {
    try {
      const response: GraphPagedResponse<Site> = await this.client
        .api('/sites')
        .query({ search: query })
        .select('id,name,displayName,webUrl,description,createdDateTime,lastModifiedDateTime')
        .get();

      return response.value;
    } catch (error) {
      console.error('[SharePoint] Failed to search sites:', error);
      throw new SharePointError('Failed to search SharePoint sites', error);
    }
  }

  /**
   * Get a specific site by ID
   */
  async getSite(siteId: string): Promise<Site> {
    try {
      return await this.client
        .api(`/sites/${siteId}`)
        .select('id,name,displayName,webUrl,description,createdDateTime,lastModifiedDateTime')
        .get();
    } catch (error) {
      console.error(`[SharePoint] Failed to get site ${siteId}:`, error);
      throw new SharePointError(`Failed to get site: ${siteId}`, error);
    }
  }

  /**
   * List document libraries in a site
   */
  async listLibraries(siteId: string): Promise<Library[]> {
    try {
      const response: GraphPagedResponse<Library> = await this.client
        .api(`/sites/${siteId}/drives`)
        .select('id,name,description,webUrl,driveType,createdDateTime,lastModifiedDateTime,quota')
        .get();

      return response.value;
    } catch (error) {
      console.error(`[SharePoint] Failed to list libraries for site ${siteId}:`, error);
      throw new SharePointError(`Failed to list libraries for site: ${siteId}`, error);
    }
  }

  /**
   * Get a specific library (drive) by ID
   */
  async getLibrary(siteId: string, libraryId: string): Promise<Library> {
    try {
      return await this.client
        .api(`/sites/${siteId}/drives/${libraryId}`)
        .select('id,name,description,webUrl,driveType,createdDateTime,lastModifiedDateTime,quota')
        .get();
    } catch (error) {
      console.error(`[SharePoint] Failed to get library ${libraryId}:`, error);
      throw new SharePointError(`Failed to get library: ${libraryId}`, error);
    }
  }

  /**
   * List files and folders in a library
   * @param siteId - SharePoint site ID
   * @param libraryId - Document library (drive) ID
   * @param path - Optional folder path (e.g., "/Documents/Projects")
   * @param options - Query options (top, filter)
   */
  async listFiles(
    siteId: string,
    libraryId: string,
    path?: string,
    options: { top?: number; filter?: string } = {}
  ): Promise<SharePointFile[]> {
    try {
      const basePath = path && path !== '/'
        ? `/sites/${siteId}/drives/${libraryId}/root:${path}:/children`
        : `/sites/${siteId}/drives/${libraryId}/root/children`;

      let request = this.client
        .api(basePath)
        .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,parentReference,file,folder')
        .top(options.top || 100);

      if (options.filter) {
        request = request.filter(options.filter);
      }

      const response: GraphPagedResponse<DriveItem> = await request.get();
      return response.value.map(toSharePointFile);
    } catch (error) {
      console.error(`[SharePoint] Failed to list files in ${libraryId}:`, error);
      throw new SharePointError(`Failed to list files in library: ${libraryId}`, error);
    }
  }

  /**
   * Get a specific file/folder item by ID
   */
  async getItem(siteId: string, libraryId: string, itemId: string): Promise<SharePointFile> {
    try {
      const item: DriveItem = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}`)
        .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,parentReference,file,folder,@microsoft.graph.downloadUrl')
        .get();

      return toSharePointFile(item);
    } catch (error) {
      console.error(`[SharePoint] Failed to get item ${itemId}:`, error);
      throw new SharePointError(`Failed to get item: ${itemId}`, error);
    }
  }

  /**
   * Upload a file to SharePoint
   * Uses simple upload for small files, upload session for large files
   */
  async uploadFile(
    siteId: string,
    libraryId: string,
    path: string,
    content: Buffer,
    options: { conflictBehavior?: 'fail' | 'replace' | 'rename' } = {}
  ): Promise<SharePointFile> {
    try {
      // Clean path - ensure it starts with /
      const cleanPath = path.startsWith('/') ? path : `/${path}`;

      // Determine upload method based on file size
      if (content.length > LARGE_FILE_THRESHOLD) {
        return await this.uploadLargeFile(siteId, libraryId, cleanPath, content, options);
      }

      // Simple upload for small files
      const conflictBehavior = options.conflictBehavior || 'fail';
      const item: DriveItem = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/root:${cleanPath}:/content`)
        .query({ '@microsoft.graph.conflictBehavior': conflictBehavior })
        .put(content);

      return toSharePointFile(item);
    } catch (error) {
      console.error(`[SharePoint] Failed to upload file ${path}:`, error);
      throw new SharePointError(`Failed to upload file: ${path}`, error);
    }
  }

  /**
   * Upload large file using upload session (chunked upload)
   */
  private async uploadLargeFile(
    siteId: string,
    libraryId: string,
    path: string,
    content: Buffer,
    options: { conflictBehavior?: 'fail' | 'replace' | 'rename' }
  ): Promise<SharePointFile> {
    // Create upload session
    const session: UploadSession = await this.client
      .api(`/sites/${siteId}/drives/${libraryId}/root:${path}:/createUploadSession`)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': options.conflictBehavior || 'fail',
        },
      });

    // Upload in chunks
    const fileSize = content.length;
    let offset = 0;
    let result: DriveItem | undefined;

    while (offset < fileSize) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize);
      const chunk = content.slice(offset, chunkEnd);

      const response = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': `bytes ${offset}-${chunkEnd - 1}/${fileSize}`,
        },
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.status} ${response.statusText}`);
      }

      const json = await response.json() as Partial<DriveItem>;
      
      // Last chunk returns the created item
      if (json.id) {
        result = json as DriveItem;
      }

      offset = chunkEnd;
    }

    if (!result) {
      throw new Error('Upload completed but no item returned');
    }

    return toSharePointFile(result);
  }

  /**
   * Download a file
   * Returns the file content as Buffer
   */
  async downloadFile(siteId: string, libraryId: string, itemId: string): Promise<Buffer> {
    try {
      // Get download URL
      const item: DriveItem = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}`)
        .select('id,@microsoft.graph.downloadUrl')
        .get();

      const downloadUrl = item['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) {
        throw new Error('No download URL available for this item');
      }

      // Download the file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`[SharePoint] Failed to download item ${itemId}:`, error);
      throw new SharePointError(`Failed to download item: ${itemId}`, error);
    }
  }

  /**
   * Get a pre-signed download URL for a file
   * URL is valid for a short period
   */
  async getDownloadUrl(siteId: string, libraryId: string, itemId: string): Promise<string> {
    try {
      const item: DriveItem = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}`)
        .select('id,@microsoft.graph.downloadUrl')
        .get();

      const downloadUrl = item['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) {
        throw new Error('No download URL available for this item');
      }

      return downloadUrl;
    } catch (error) {
      console.error(`[SharePoint] Failed to get download URL for ${itemId}:`, error);
      throw new SharePointError(`Failed to get download URL: ${itemId}`, error);
    }
  }

  /**
   * Create a folder in a library
   */
  async createFolder(
    siteId: string,
    libraryId: string,
    name: string,
    parentPath?: string
  ): Promise<SharePointFile> {
    try {
      const basePath = parentPath && parentPath !== '/'
        ? `/sites/${siteId}/drives/${libraryId}/root:${parentPath}:/children`
        : `/sites/${siteId}/drives/${libraryId}/root/children`;

      const item: DriveItem = await this.client
        .api(basePath)
        .post({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });

      return toSharePointFile(item);
    } catch (error) {
      console.error(`[SharePoint] Failed to create folder ${name}:`, error);
      throw new SharePointError(`Failed to create folder: ${name}`, error);
    }
  }

  /**
   * Delete a file or folder
   */
  async deleteItem(siteId: string, libraryId: string, itemId: string): Promise<void> {
    try {
      await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}`)
        .delete();
    } catch (error) {
      console.error(`[SharePoint] Failed to delete item ${itemId}:`, error);
      throw new SharePointError(`Failed to delete item: ${itemId}`, error);
    }
  }

  /**
   * Move a file or folder to a new location
   */
  async moveItem(
    siteId: string,
    libraryId: string,
    itemId: string,
    newParentId: string,
    newName?: string
  ): Promise<SharePointFile> {
    try {
      const update: Record<string, unknown> = {
        parentReference: {
          id: newParentId,
        },
      };

      if (newName) {
        update.name = newName;
      }

      const item: DriveItem = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}`)
        .patch(update);

      return toSharePointFile(item);
    } catch (error) {
      console.error(`[SharePoint] Failed to move item ${itemId}:`, error);
      throw new SharePointError(`Failed to move item: ${itemId}`, error);
    }
  }

  /**
   * Copy a file or folder
   */
  async copyItem(
    siteId: string,
    libraryId: string,
    itemId: string,
    destinationParentId: string,
    newName?: string
  ): Promise<{ monitorUrl: string }> {
    try {
      const body: Record<string, unknown> = {
        parentReference: {
          driveId: libraryId,
          id: destinationParentId,
        },
      };

      if (newName) {
        body.name = newName;
      }

      // Copy is async - returns a monitor URL
      const response = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/items/${itemId}/copy`)
        .post(body);

      // Graph returns Location header with monitor URL
      return { monitorUrl: response?.headers?.Location || '' };
    } catch (error) {
      console.error(`[SharePoint] Failed to copy item ${itemId}:`, error);
      throw new SharePointError(`Failed to copy item: ${itemId}`, error);
    }
  }

  /**
   * Search for files in a library
   */
  async searchFiles(
    siteId: string,
    libraryId: string,
    query: string
  ): Promise<SharePointFile[]> {
    try {
      const response: GraphPagedResponse<DriveItem> = await this.client
        .api(`/sites/${siteId}/drives/${libraryId}/root/search(q='${encodeURIComponent(query)}')`)
        .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,parentReference,file,folder')
        .top(100)
        .get();

      return response.value.map(toSharePointFile);
    } catch (error) {
      console.error(`[SharePoint] Failed to search files:`, error);
      throw new SharePointError(`Failed to search files`, error);
    }
  }
}

/**
 * Custom error class for SharePoint operations
 */
export class SharePointError extends Error {
  public readonly cause?: unknown;
  public readonly code?: string;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SharePointError';
    this.cause = cause;

    // Extract error code from Graph API error
    if (cause && typeof cause === 'object' && 'code' in cause) {
      this.code = (cause as { code: string }).code;
    }
  }

  /**
   * Check if error is due to item not found
   */
  isNotFound(): boolean {
    return this.code === 'itemNotFound' || this.code === 'notFound';
  }

  /**
   * Check if error is due to access denied
   */
  isAccessDenied(): boolean {
    return this.code === 'accessDenied' || this.code === 'AccessDenied';
  }

  /**
   * Check if error is due to conflict (e.g., file already exists)
   */
  isConflict(): boolean {
    return this.code === 'nameAlreadyExists' || this.code === 'conflict';
  }
}

export default SharePointService;
