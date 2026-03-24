/**
 * Agent Credential Isolation
 * Based on KB: Agent Credential Isolation
 */

interface AgentCredentials {
  agentId: string;
  credentials: Map<string, EncryptedCredential>;
  accessLog: CredentialAccess[];
}

interface EncryptedCredential {
  name: string;
  encryptedValue: string;
  createdAt: Date;
  expiresAt?: Date;
  allowedOperations: string[];
}

interface CredentialAccess {
  timestamp: Date;
  operation: string;
  success: boolean;
  credentialName?: string;
}

export interface CredentialInfo {
  name: string;
  createdAt: Date;
  expiresAt?: Date;
  allowedOperations: string[];
}

export class CredentialIsolationService {
  private agentCredentials: Map<string, AgentCredentials> = new Map();

  // Store credential for specific agent only
  async storeCredential(agentId: string, name: string, value: string, options?: {
    expiresIn?: number;
    allowedOperations?: string[];
  }): Promise<void> {
    const encrypted = await this.encrypt(value);
    
    if (!this.agentCredentials.has(agentId)) {
      this.agentCredentials.set(agentId, {
        agentId,
        credentials: new Map(),
        accessLog: [],
      });
    }
    
    const agent = this.agentCredentials.get(agentId)!;
    agent.credentials.set(name, {
      name,
      encryptedValue: encrypted,
      createdAt: new Date(),
      expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
      allowedOperations: options?.allowedOperations || ['read'],
    });
  }

  // Get credential - only for owning agent
  async getCredential(agentId: string, name: string, operation: string): Promise<string | null> {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return null;
    
    const cred = agent.credentials.get(name);
    if (!cred) return null;
    
    // Check expiration
    if (cred.expiresAt && cred.expiresAt < new Date()) {
      agent.credentials.delete(name);
      this.logAccess(agent, name, operation, false);
      return null;
    }
    
    // Check operation allowed
    if (!cred.allowedOperations.includes(operation)) {
      this.logAccess(agent, name, operation, false);
      return null;
    }
    
    // Log access
    this.logAccess(agent, name, operation, true);
    
    return this.decrypt(cred.encryptedValue);
  }

  // List credentials for agent (without values)
  listCredentials(agentId: string): CredentialInfo[] {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return [];

    return Array.from(agent.credentials.values()).map(cred => ({
      name: cred.name,
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt,
      allowedOperations: cred.allowedOperations,
    }));
  }

  // Check if credential exists
  hasCredential(agentId: string, name: string): boolean {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return false;
    
    const cred = agent.credentials.get(name);
    if (!cred) return false;
    
    // Check expiration
    if (cred.expiresAt && cred.expiresAt < new Date()) {
      agent.credentials.delete(name);
      return false;
    }
    
    return true;
  }

  // Delete specific credential
  deleteCredential(agentId: string, name: string): boolean {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return false;
    
    return agent.credentials.delete(name);
  }

  // Rotate all credentials for agent
  async rotateCredentials(agentId: string): Promise<void> {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return;
    
    // Mark all as expired, requiring re-provisioning
    agent.credentials.clear();
    agent.accessLog.push({
      timestamp: new Date(),
      operation: 'rotate_all',
      success: true,
    });
  }

  // Get access log for agent
  getAccessLog(agentId: string, limit?: number): CredentialAccess[] {
    const agent = this.agentCredentials.get(agentId);
    if (!agent) return [];
    
    const log = agent.accessLog;
    if (limit) {
      return log.slice(-limit);
    }
    return [...log];
  }

  // Clear access log for agent
  clearAccessLog(agentId: string): void {
    const agent = this.agentCredentials.get(agentId);
    if (agent) {
      agent.accessLog = [];
    }
  }

  // Remove all credentials and data for agent
  removeAgent(agentId: string): boolean {
    return this.agentCredentials.delete(agentId);
  }

  // List all agent IDs with credentials
  listAgents(): string[] {
    return Array.from(this.agentCredentials.keys());
  }

  private logAccess(agent: AgentCredentials, credentialName: string, operation: string, success: boolean): void {
    agent.accessLog.push({
      timestamp: new Date(),
      operation,
      success,
      credentialName,
    });

    // Keep only last 1000 entries
    if (agent.accessLog.length > 1000) {
      agent.accessLog = agent.accessLog.slice(-1000);
    }
  }

  private async encrypt(value: string): Promise<string> {
    // In production: use proper encryption (AES-256-GCM)
    // This should use crypto.createCipheriv with a secure key from env/vault
    return Buffer.from(value).toString('base64');
  }

  private async decrypt(encrypted: string): Promise<string> {
    // In production: use proper decryption
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
}

// Singleton instance
export const credentialIsolationService = new CredentialIsolationService();
