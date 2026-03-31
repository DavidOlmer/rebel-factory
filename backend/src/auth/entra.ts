/**
 * Azure Entra ID (Azure AD) Authentication Provider
 * 
 * Wraps MSAL-Node for enterprise authentication
 */
import { 
  ConfidentialClientApplication, 
  Configuration,
  AuthenticationResult,
  AccountInfo
} from '@azure/msal-node';
import { config } from '../config/env';

// Entra ID configuration
const msalConfig: Configuration = {
  auth: {
    clientId: config.azure.clientId,
    authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
    clientSecret: config.azure.clientSecret,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii && config.env === 'development') {
          console.debug('[MSAL]', message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Info
    },
  },
};

// Default scopes for Microsoft Graph
export const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'User.Read',
];

// Extended scopes for SharePoint/OneDrive
export const SHAREPOINT_SCOPES = [
  ...DEFAULT_SCOPES,
  'Sites.Read.All',
  'Files.Read.All',
];

/**
 * Entra ID Authentication Provider
 * Singleton pattern for MSAL client management
 */
export class EntraAuthProvider {
  private static instance: EntraAuthProvider;
  private msalClient: ConfidentialClientApplication;
  private initialized: boolean = false;

  private constructor() {
    this.msalClient = new ConfidentialClientApplication(msalConfig);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EntraAuthProvider {
    if (!EntraAuthProvider.instance) {
      EntraAuthProvider.instance = new EntraAuthProvider();
    }
    return EntraAuthProvider.instance;
  }

  /**
   * Get the underlying MSAL client
   */
  getClient(): ConfidentialClientApplication {
    return this.msalClient;
  }

  /**
   * Check if Entra ID is configured
   */
  isConfigured(): boolean {
    return !!(config.azure.clientId && config.azure.tenantId && config.azure.clientSecret);
  }

  /**
   * Get authorization URL for OAuth flow
   */
  async getAuthorizationUrl(options: {
    scopes?: string[];
    redirectUri: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<string> {
    return this.msalClient.getAuthCodeUrl({
      scopes: options.scopes || DEFAULT_SCOPES,
      redirectUri: options.redirectUri,
      state: options.state,
      codeChallenge: options.codeChallenge,
      codeChallengeMethod: options.codeChallengeMethod || 'S256',
      prompt: 'select_account',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async acquireTokenByCode(options: {
    code: string;
    scopes?: string[];
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<AuthenticationResult | null> {
    return this.msalClient.acquireTokenByCode({
      code: options.code,
      scopes: options.scopes || DEFAULT_SCOPES,
      redirectUri: options.redirectUri,
      codeVerifier: options.codeVerifier,
    });
  }

  /**
   * Get token silently (from cache or refresh)
   */
  async acquireTokenSilent(options: {
    account: AccountInfo;
    scopes?: string[];
  }): Promise<AuthenticationResult | null> {
    try {
      return await this.msalClient.acquireTokenSilent({
        account: options.account,
        scopes: options.scopes || DEFAULT_SCOPES,
      });
    } catch {
      // Silent acquisition failed - need interactive login
      return null;
    }
  }

  /**
   * Get token using client credentials (for app-only scenarios)
   */
  async acquireTokenForApp(scopes: string[] = ['https://graph.microsoft.com/.default']): Promise<AuthenticationResult | null> {
    try {
      return await this.msalClient.acquireTokenByClientCredential({
        scopes,
      });
    } catch (error) {
      console.error('[Entra] Client credential flow failed:', error);
      return null;
    }
  }

  /**
   * Fetch user profile from Microsoft Graph
   */
  async getUserProfile(accessToken: string): Promise<MicrosoftUserProfile | null> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Graph API error: ${response.status}`);
      }

      return await response.json() as MicrosoftUserProfile;
    } catch (error) {
      console.error('[Entra] Failed to fetch user profile:', error);
      return null;
    }
  }

  /**
   * Fetch user's group memberships
   */
  async getUserGroups(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as {
        value?: Array<{ '@odata.type'?: string; displayName?: string }>;
      };

      return data.value
        ?.filter((item) => item['@odata.type'] === '#microsoft.graph.group')
        .map((group) => group.displayName)
        .filter((groupName): groupName is string => Boolean(groupName)) || [];
    } catch {
      return [];
    }
  }
}

/**
 * Microsoft user profile from Graph API
 */
export interface MicrosoftUserProfile {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

/**
 * Map Microsoft user to application user
 */
export function mapMicrosoftUserToAppUser(msUser: MicrosoftUserProfile, groups: string[] = []): {
  id: string;
  email: string;
  name: string;
  roles: string[];
  azureId: string;
  department?: string;
  jobTitle?: string;
} {
  const roles: string[] = ['member'];

  // Admin based on group membership
  const adminGroups = ['AI-Factory-Admins', 'IT-Admins', 'Global-Admins'];
  if (groups.some(g => adminGroups.includes(g))) {
    roles.push('admin');
  }

  // Internal user based on domain
  const email = msUser.mail || msUser.userPrincipalName;
  if (email.endsWith('@rebelai.nl') || email.endsWith('@rebelgroup.com')) {
    roles.push('rebel');
  }

  return {
    id: msUser.userPrincipalName,
    email,
    name: msUser.displayName,
    roles,
    azureId: msUser.id,
    department: msUser.department,
    jobTitle: msUser.jobTitle,
  };
}

// Export singleton instance getter
export const getEntraProvider = () => EntraAuthProvider.getInstance();
