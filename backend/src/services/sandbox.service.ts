/**
 * Agent Sandboxing - Secure execution boundaries
 * Based on KB: Agent Sandboxing Patterns
 */

export interface SandboxConfig {
  agentId: string;
  allowedTools: string[];
  allowedEnvVars: string[];
  maxExecutionTime: number;  // ms
  maxMemory: number;         // bytes
  networkAccess: 'none' | 'internal' | 'external';
  fileSystemAccess: 'none' | 'readonly' | 'workspace';
}

export interface SandboxResult {
  success: boolean;
  output: string;
  executionTime: number;
  memoryUsed: number;
  errors?: string[];
}

export class SandboxService {
  private sandboxes: Map<string, SandboxConfig> = new Map();

  // Create sandbox for agent
  createSandbox(agentId: string, config: Partial<SandboxConfig>): SandboxConfig {
    const sandbox: SandboxConfig = {
      agentId,
      allowedTools: config.allowedTools || ['read', 'write', 'bash'],
      allowedEnvVars: config.allowedEnvVars || ['PATH', 'HOME'],
      maxExecutionTime: config.maxExecutionTime || 30000,
      maxMemory: config.maxMemory || 512 * 1024 * 1024, // 512MB
      networkAccess: config.networkAccess || 'internal',
      fileSystemAccess: config.fileSystemAccess || 'workspace',
    };
    this.sandboxes.set(agentId, sandbox);
    return sandbox;
  }

  // Get sandbox config
  getSandbox(agentId: string): SandboxConfig | undefined {
    return this.sandboxes.get(agentId);
  }

  // List all sandboxes
  listSandboxes(): SandboxConfig[] {
    return Array.from(this.sandboxes.values());
  }

  // Update sandbox config
  updateSandbox(agentId: string, config: Partial<SandboxConfig>): SandboxConfig | null {
    const existing = this.sandboxes.get(agentId);
    if (!existing) return null;

    const updated: SandboxConfig = {
      ...existing,
      ...config,
      agentId, // Cannot change agentId
    };
    this.sandboxes.set(agentId, updated);
    return updated;
  }

  // Destroy sandbox
  destroySandbox(agentId: string): boolean {
    return this.sandboxes.delete(agentId);
  }

  // Execute code in sandbox
  async execute(agentId: string, code: string): Promise<SandboxResult> {
    const config = this.sandboxes.get(agentId);
    if (!config) throw new Error('No sandbox configured for agent');

    const startTime = Date.now();
    
    // Create isolated environment
    const env = this.createIsolatedEnv(config);
    
    try {
      // Execute with timeout
      const result = await this.runWithTimeout(code, env, config.maxExecutionTime);
      
      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        errors: [error.message],
      };
    }
  }

  // Check if tool is allowed
  isToolAllowed(agentId: string, tool: string): boolean {
    const config = this.sandboxes.get(agentId);
    return config?.allowedTools.includes(tool) || false;
  }

  // Check if env var is allowed
  isEnvVarAllowed(agentId: string, envVar: string): boolean {
    const config = this.sandboxes.get(agentId);
    return config?.allowedEnvVars.includes(envVar) || false;
  }

  // Validate network access level
  canAccessNetwork(agentId: string, level: 'internal' | 'external'): boolean {
    const config = this.sandboxes.get(agentId);
    if (!config) return false;
    
    if (config.networkAccess === 'none') return false;
    if (config.networkAccess === 'external') return true;
    if (config.networkAccess === 'internal' && level === 'internal') return true;
    return false;
  }

  // Validate filesystem access
  canAccessFilesystem(agentId: string, operation: 'read' | 'write'): boolean {
    const config = this.sandboxes.get(agentId);
    if (!config) return false;
    
    if (config.fileSystemAccess === 'none') return false;
    if (config.fileSystemAccess === 'workspace') return true;
    if (config.fileSystemAccess === 'readonly' && operation === 'read') return true;
    return false;
  }

  private createIsolatedEnv(config: SandboxConfig): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const key of config.allowedEnvVars) {
      if (process.env[key]) env[key] = process.env[key];
    }
    return env;
  }

  private async runWithTimeout(code: string, env: NodeJS.ProcessEnv, timeout: number): Promise<string> {
    // In production: use VM2, isolated-vm, or container
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Execution timeout')), timeout);
      try {
        // Simplified execution - in production use proper isolation
        resolve('Executed in sandbox');
        clearTimeout(timer);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });
  }
}

// Singleton instance
export const sandboxService = new SandboxService();
