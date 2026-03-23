/**
 * Microsoft Graph API Client Configuration
 * Handles token acquisition with on-behalf-of flow for SharePoint access
 */
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication, OnBehalfOfRequest } from '@azure/msal-node';
import { getMsalClient } from './msal';
import 'isomorphic-fetch';

// Graph API scopes for SharePoint operations
export const GRAPH_SCOPES = {
  // Site & library operations
  SITES_READ: 'Sites.Read.All',
  SITES_WRITE: 'Sites.ReadWrite.All',
  // File operations
  FILES_READ: 'Files.Read.All',
  FILES_WRITE: 'Files.ReadWrite.All',
};

// Default scopes for SharePoint integration
export const DEFAULT_SHAREPOINT_SCOPES = [
  GRAPH_SCOPES.SITES_WRITE,
  GRAPH_SCOPES.FILES_WRITE,
];

/**
 * Get access token using On-Behalf-Of flow
 * Exchanges user's access token for Graph API token
 */
export async function getOnBehalfOfToken(userToken: string): Promise<string> {
  const msalClient = getMsalClient();
  
  const oboRequest: OnBehalfOfRequest = {
    oboAssertion: userToken,
    scopes: DEFAULT_SHAREPOINT_SCOPES,
  };

  try {
    const response = await msalClient.acquireTokenOnBehalfOf(oboRequest);
    if (!response || !response.accessToken) {
      throw new Error('Failed to acquire token via OBO flow');
    }
    return response.accessToken;
  } catch (error) {
    console.error('[Graph] OBO token acquisition failed:', error);
    throw new Error('Failed to acquire Graph API access token');
  }
}

/**
 * Get access token using Client Credentials flow (app-only)
 * Used for operations that don't require user context
 */
export async function getClientCredentialsToken(): Promise<string> {
  const msalClient = getMsalClient();
  
  try {
    const response = await msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    
    if (!response || !response.accessToken) {
      throw new Error('Failed to acquire token via client credentials');
    }
    return response.accessToken;
  } catch (error) {
    console.error('[Graph] Client credentials token acquisition failed:', error);
    throw new Error('Failed to acquire Graph API app token');
  }
}

/**
 * Create authenticated Graph client for user operations
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Create Graph client with OBO flow
 * Automatically handles token exchange
 */
export async function createGraphClientWithOBO(userToken: string): Promise<Client> {
  const graphToken = await getOnBehalfOfToken(userToken);
  return createGraphClient(graphToken);
}

/**
 * Create Graph client with app-only permissions
 */
export async function createAppGraphClient(): Promise<Client> {
  const appToken = await getClientCredentialsToken();
  return createGraphClient(appToken);
}

/**
 * Graph API response types
 */
export interface GraphPagedResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
}

/**
 * Helper to fetch all pages of a paginated Graph response
 */
export async function fetchAllPages<T>(
  client: Client,
  initialPath: string
): Promise<T[]> {
  const results: T[] = [];
  let nextLink: string | undefined = initialPath;

  while (nextLink) {
    const response: GraphPagedResponse<T> = await client.api(nextLink).get();
    results.push(...response.value);
    nextLink = response['@odata.nextLink'];
  }

  return results;
}

export default {
  createGraphClient,
  createGraphClientWithOBO,
  createAppGraphClient,
  getOnBehalfOfToken,
  getClientCredentialsToken,
  fetchAllPages,
  GRAPH_SCOPES,
  DEFAULT_SHAREPOINT_SCOPES,
};
