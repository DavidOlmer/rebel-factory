/**
 * Environment Configuration
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`⚠️ Missing required env var: ${name}`);
  }
  return value || '';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3300', 10),
  
  azure: {
    clientId: required('AZURE_CLIENT_ID'),
    tenantId: required('AZURE_TENANT_ID'),
    clientSecret: required('AZURE_CLIENT_SECRET'),
    redirectUri: process.env.REDIRECT_URI || 'http://localhost:3300/auth/callback',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgres://paperclip:paperclip@127.0.0.1:54329/paperclip',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  sharepoint: {
    siteUrl: process.env.SHAREPOINT_SITE_URL || '',
    driveId: process.env.SHAREPOINT_DRIVE_ID || '',
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3400',
  },
};

export function validateConfig(): void {
  if (!config.frontend.url) {
    throw new Error('FRONTEND_URL must be configured');
  }
}
