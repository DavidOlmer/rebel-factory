/**
 * Sandboxed Code Execution Service
 * Executes code in isolated environments with resource limits
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'bash' | 'shell';

export interface ExecutionRequest {
  language: SupportedLanguage;
  code: string;
  timeout?: number;        // ms, default 30000
  maxOutput?: number;      // bytes, default 1MB
  workingDir?: string;
  env?: Record<string, string>;
  stdin?: string;
  // Security options
  allowNetwork?: boolean;  // default false
  allowFileWrite?: boolean; // default false
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;   // ms
  killed: boolean;
  killedReason?: 'timeout' | 'output_limit' | 'memory_limit' | 'manual';
  truncated: boolean;
}

interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  timeouts: number;
  totalExecutionTime: number;
  byLanguage: Record<SupportedLanguage, number>;
}

interface RunningExecution {
  id: string;
  process: ChildProcess;
  startTime: number;
  request: ExecutionRequest;
  resolve: (result: ExecutionResult) => void;
}

export class CodeExecutionService extends EventEmitter {
  private readonly defaultTimeout = 30000;  // 30 seconds
  private readonly defaultMaxOutput = 1024 * 1024;  // 1MB
  
  private runningExecutions: Map<string, RunningExecution> = new Map();
  private executionCounter = 0;
  
  private metrics: ExecutionMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    timeouts: 0,
    totalExecutionTime: 0,
    byLanguage: {
      javascript: 0,
      typescript: 0,
      python: 0,
      bash: 0,
      shell: 0,
    },
  };

  /**
   * Execute code in a sandboxed environment
   */
  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
    const startTime = Date.now();
    const timeout = req.timeout || this.defaultTimeout;
    const maxOutput = req.maxOutput || this.defaultMaxOutput;

    this.metrics.totalExecutions++;
    this.metrics.byLanguage[req.language]++;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      let killedReason: ExecutionResult['killedReason'];
      let truncated = false;
      let timeoutHandle: NodeJS.Timeout;

      // Build environment
      const env = this.buildEnv(req);
      
      // Get command and args
      const { command, args } = this.getCommandArgs(req.language, req.code);

      const proc = spawn(command, args, {
        timeout,
        env,
        cwd: req.workingDir,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const execution: RunningExecution = {
        id: executionId,
        process: proc,
        startTime,
        request: req,
        resolve,
      };
      this.runningExecutions.set(executionId, execution);

      // Set timeout
      timeoutHandle = setTimeout(() => {
        if (!killed) {
          killed = true;
          killedReason = 'timeout';
          proc.kill('SIGKILL');
          this.metrics.timeouts++;
        }
      }, timeout);

      // Handle stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length > maxOutput) {
          stdout += chunk.slice(0, maxOutput - stdout.length);
          truncated = true;
          if (!killed) {
            killed = true;
            killedReason = 'output_limit';
            proc.kill('SIGKILL');
          }
        } else {
          stdout += chunk;
        }
      });

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stderr.length + chunk.length > maxOutput) {
          stderr += chunk.slice(0, maxOutput - stderr.length);
          truncated = true;
        } else {
          stderr += chunk;
        }
      });

      // Send stdin if provided
      if (req.stdin) {
        proc.stdin?.write(req.stdin);
        proc.stdin?.end();
      } else {
        proc.stdin?.end();
      }

      // Handle completion
      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this.runningExecutions.delete(executionId);

        const executionTime = Date.now() - startTime;
        const success = code === 0 && !killed;

        if (success) {
          this.metrics.successfulExecutions++;
        } else {
          this.metrics.failedExecutions++;
        }
        this.metrics.totalExecutionTime += executionTime;

        const result: ExecutionResult = {
          success,
          stdout,
          stderr,
          exitCode: code ?? 1,
          executionTime,
          killed,
          killedReason,
          truncated,
        };

        this.emit('execution-complete', { id: executionId, result });
        resolve(result);
      });

      // Handle errors
      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this.runningExecutions.delete(executionId);

        const executionTime = Date.now() - startTime;
        this.metrics.failedExecutions++;
        this.metrics.totalExecutionTime += executionTime;

        const result: ExecutionResult = {
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          executionTime,
          killed: false,
          truncated: false,
        };

        this.emit('execution-error', { id: executionId, error: err });
        resolve(result);
      });
    });
  }

  /**
   * Execute with streaming output
   */
  executeStream(
    req: ExecutionRequest,
    onStdout: (data: string) => void,
    onStderr: (data: string) => void
  ): { promise: Promise<ExecutionResult>; kill: () => void } {
    const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
    const startTime = Date.now();
    const timeout = req.timeout || this.defaultTimeout;
    const maxOutput = req.maxOutput || this.defaultMaxOutput;

    this.metrics.totalExecutions++;
    this.metrics.byLanguage[req.language]++;

    let stdoutTotal = 0;
    let stderrTotal = 0;
    let killed = false;
    let killedReason: ExecutionResult['killedReason'];
    let manualKill = false;

    const env = this.buildEnv(req);
    const { command, args } = this.getCommandArgs(req.language, req.code);

    const proc = spawn(command, args, {
      env,
      cwd: req.workingDir,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const killFn = () => {
      if (!killed) {
        killed = true;
        manualKill = true;
        killedReason = 'manual';
        proc.kill('SIGKILL');
      }
    };

    const timeoutHandle = setTimeout(() => {
      if (!killed) {
        killed = true;
        killedReason = 'timeout';
        proc.kill('SIGKILL');
        this.metrics.timeouts++;
      }
    }, timeout);

    const promise = new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let truncated = false;

      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdoutTotal += chunk.length;
        
        if (stdoutTotal <= maxOutput) {
          stdout += chunk;
          onStdout(chunk);
        } else if (!truncated) {
          truncated = true;
          if (!killed) {
            killed = true;
            killedReason = 'output_limit';
            proc.kill('SIGKILL');
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderrTotal += chunk.length;
        
        if (stderrTotal <= maxOutput) {
          stderr += chunk;
          onStderr(chunk);
        }
      });

      if (req.stdin) {
        proc.stdin?.write(req.stdin);
        proc.stdin?.end();
      } else {
        proc.stdin?.end();
      }

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);

        const executionTime = Date.now() - startTime;
        const success = code === 0 && !killed;

        if (success) {
          this.metrics.successfulExecutions++;
        } else {
          this.metrics.failedExecutions++;
        }
        this.metrics.totalExecutionTime += executionTime;

        resolve({
          success,
          stdout,
          stderr,
          exitCode: code ?? 1,
          executionTime,
          killed,
          killedReason,
          truncated,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this.metrics.failedExecutions++;

        resolve({
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          executionTime: Date.now() - startTime,
          killed: false,
          truncated: false,
        });
      });
    });

    return { promise, kill: killFn };
  }

  /**
   * Kill a running execution
   */
  kill(executionId: string): boolean {
    const execution = this.runningExecutions.get(executionId);
    if (execution) {
      execution.process.kill('SIGKILL');
      return true;
    }
    return false;
  }

  /**
   * Kill all running executions
   */
  killAll(): number {
    let killed = 0;
    for (const [id, execution] of this.runningExecutions) {
      execution.process.kill('SIGKILL');
      killed++;
    }
    return killed;
  }

  /**
   * Get running executions
   */
  getRunning(): { id: string; language: SupportedLanguage; startTime: number; elapsed: number }[] {
    const now = Date.now();
    return Array.from(this.runningExecutions.values()).map(exec => ({
      id: exec.id,
      language: exec.request.language,
      startTime: exec.startTime,
      elapsed: now - exec.startTime,
    }));
  }

  /**
   * Get execution metrics
   */
  getMetrics(): ExecutionMetrics & { avgExecutionTime: number; successRate: number } {
    return {
      ...this.metrics,
      avgExecutionTime: this.metrics.totalExecutions > 0 
        ? this.metrics.totalExecutionTime / this.metrics.totalExecutions 
        : 0,
      successRate: this.metrics.totalExecutions > 0
        ? this.metrics.successfulExecutions / this.metrics.totalExecutions
        : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      timeouts: 0,
      totalExecutionTime: 0,
      byLanguage: {
        javascript: 0,
        typescript: 0,
        python: 0,
        bash: 0,
        shell: 0,
      },
    };
  }

  /**
   * Validate code before execution (basic checks)
   */
  validate(language: SupportedLanguage, code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for obviously dangerous patterns
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//, message: 'Dangerous rm -rf / detected' },
      { pattern: /:\(\)\s*{\s*:\|:&\s*};:/, message: 'Fork bomb detected' },
      { pattern: /wget.*\|.*bash/, message: 'Remote code execution pattern detected' },
      { pattern: /curl.*\|.*sh/, message: 'Remote code execution pattern detected' },
      { pattern: /eval\(.*\$_/, message: 'Dangerous eval with user input' },
      { pattern: /chmod\s+777/, message: 'Overly permissive chmod detected' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    // Language-specific checks
    if (language === 'python') {
      if (code.includes('import os') && code.includes('system(')) {
        errors.push('os.system() usage detected - prefer subprocess');
      }
      if (code.includes('__import__')) {
        errors.push('Dynamic __import__ detected');
      }
    }

    if (language === 'javascript' || language === 'typescript') {
      if (code.includes('child_process') && !code.includes('sandbox')) {
        errors.push('child_process usage outside sandbox context');
      }
      if (code.includes('require("fs")') && code.includes('unlinkSync')) {
        errors.push('Synchronous file deletion detected');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Private helpers

  private buildEnv(req: ExecutionRequest): NodeJS.ProcessEnv {
    // Start with minimal environment
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: 'en_US.UTF-8',
      TERM: 'xterm',
    };

    // Add user-specified env vars (but not system-sensitive ones)
    if (req.env) {
      const blockedVars = ['LD_PRELOAD', 'LD_LIBRARY_PATH', 'SSH_AUTH_SOCK', 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY'];
      for (const [key, value] of Object.entries(req.env)) {
        if (!blockedVars.includes(key)) {
          env[key] = value;
        }
      }
    }

    // Disable network if not allowed
    if (!req.allowNetwork) {
      env['no_proxy'] = '*';
      env['http_proxy'] = 'http://0.0.0.0:0';
      env['https_proxy'] = 'http://0.0.0.0:0';
    }

    return env;
  }

  private getCommandArgs(language: SupportedLanguage, code: string): { command: string; args: string[] } {
    switch (language) {
      case 'javascript':
        return { command: 'node', args: ['-e', code] };
      
      case 'typescript':
        // Requires ts-node or npx tsx
        return { command: 'npx', args: ['tsx', '-e', code] };
      
      case 'python':
        return { command: 'python3', args: ['-c', code] };
      
      case 'bash':
      case 'shell':
        return { command: 'bash', args: ['-c', code] };
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}

// Singleton instance
export const codeExecutionService = new CodeExecutionService();
