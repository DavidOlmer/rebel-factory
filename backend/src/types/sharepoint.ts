import { z } from 'zod';

/**
 * SharePoint / Microsoft Graph Types
 */

// SharePoint Site
export interface Site {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  description?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  root?: {
    id: string;
  };
}

// Document Library (Drive)
export interface Library {
  id: string;
  name: string;
  description?: string;
  webUrl: string;
  driveType: 'documentLibrary' | 'personal' | 'business';
  createdDateTime: string;
  lastModifiedDateTime: string;
  quota?: {
    total: number;
    used: number;
    remaining: number;
  };
}

// Drive Item (File or Folder)
export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: {
    user: {
      id: string;
      displayName: string;
      email?: string;
    };
  };
  lastModifiedBy?: {
    user: {
      id: string;
      displayName: string;
      email?: string;
    };
  };
  parentReference?: {
    id: string;
    path: string;
    driveId: string;
    siteId?: string;
  };
  file?: {
    mimeType: string;
    hashes?: {
      sha256Hash?: string;
      quickXorHash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  '@microsoft.graph.downloadUrl'?: string;
}

// Simplified types for API responses
export interface SharePointFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  webUrl: string;
  isFolder: boolean;
  childCount?: number;
  createdAt: string;
  modifiedAt: string;
  createdBy?: string;
  modifiedBy?: string;
  downloadUrl?: string;
}

export interface SharePointFolder extends SharePointFile {
  isFolder: true;
  childCount: number;
}

// Upload session for large files
export interface UploadSession {
  uploadUrl: string;
  expirationDateTime: string;
}

// Validation schemas
export const SiteIdSchema = z.string().min(1);
export const LibraryIdSchema = z.string().min(1);
export const ItemIdSchema = z.string().min(1);
export const PathSchema = z.string().optional();

export const UploadFileSchema = z.object({
  name: z.string().min(1).max(400),
  path: z.string().optional(),
  conflictBehavior: z.enum(['fail', 'replace', 'rename']).default('fail'),
});

export const CreateFolderSchema = z.object({
  name: z.string().min(1).max(400),
  parentPath: z.string().optional(),
});

export const ListFilesQuerySchema = z.object({
  path: z.string().optional(),
  recursive: z.coerce.boolean().default(false),
  filter: z.string().optional(),
  top: z.coerce.number().min(1).max(1000).default(100),
});

// Convert Graph API DriveItem to simplified SharePointFile
export function toSharePointFile(item: DriveItem): SharePointFile {
  return {
    id: item.id,
    name: item.name,
    path: item.parentReference?.path 
      ? `${item.parentReference.path.replace(/^\/drive\/root:?/, '')}/${item.name}`
      : `/${item.name}`,
    size: item.size,
    mimeType: item.file?.mimeType,
    webUrl: item.webUrl,
    isFolder: !!item.folder,
    childCount: item.folder?.childCount,
    createdAt: item.createdDateTime,
    modifiedAt: item.lastModifiedDateTime,
    createdBy: item.createdBy?.user?.displayName,
    modifiedBy: item.lastModifiedBy?.user?.displayName,
    downloadUrl: item['@microsoft.graph.downloadUrl'],
  };
}

export type { DriveItem as GraphDriveItem };
