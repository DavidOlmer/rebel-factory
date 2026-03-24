/**
 * Code Execution Routes
 * API for sandboxed code execution
 */

import { Router, Request, Response } from 'express';
import { 
  codeExecutionService, 
  SupportedLanguage,
  ExecutionRequest 
} from '../services/code-execution.service';
import { validateToken } from '../middleware/auth';

const router = Router();

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['javascript', 'typescript', 'python', 'bash', 'shell'];

/**
 * POST /execute
 * Execute code in sandbox
 */
router.post('/execute', validateToken, async (req: Request, res: Response) => {
  try {
    const { 
      language, 
      code, 
      timeout,
      maxOutput,
      workingDir,
      env,
      stdin,
      allowNetwork,
      allowFileWrite,
    } = req.body;

    // Validate required fields
    if (!language || !code) {
      return res.status(400).json({ error: 'language and code are required' });
    }

    // Validate language
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ 
        error: `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }

    // Validate timeout
    if (timeout !== undefined) {
      if (timeout < 100 || timeout > 300000) {
        return res.status(400).json({ error: 'timeout must be between 100ms and 300000ms (5 min)' });
      }
    }

    // Validate code
    const validation = codeExecutionService.validate(language, code);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Code validation failed',
        details: validation.errors,
      });
    }

    const request: ExecutionRequest = {
      language,
      code,
      timeout: timeout || 30000,
      maxOutput: maxOutput || 1024 * 1024,
      workingDir,
      env,
      stdin,
      allowNetwork: allowNetwork || false,
      allowFileWrite: allowFileWrite || false,
    };

    const result = await codeExecutionService.execute(request);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /validate
 * Validate code without executing
 */
router.post('/validate', validateToken, async (req: Request, res: Response) => {
  try {
    const { language, code } = req.body;

    if (!language || !code) {
      return res.status(400).json({ error: 'language and code are required' });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ 
        error: `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }

    const result = codeExecutionService.validate(language, code);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /running
 * Get list of running executions
 */
router.get('/running', validateToken, async (req: Request, res: Response) => {
  try {
    const running = codeExecutionService.getRunning();
    res.json({ running });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /kill/:executionId
 * Kill a running execution
 */
router.post('/kill/:executionId', validateToken, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const killed = codeExecutionService.kill(executionId);
    
    if (!killed) {
      return res.status(404).json({ error: 'Execution not found or already completed' });
    }

    res.json({ killed: true, executionId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /kill-all
 * Kill all running executions
 */
router.post('/kill-all', validateToken, async (req: Request, res: Response) => {
  try {
    const count = codeExecutionService.killAll();
    res.json({ killed: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /metrics
 * Get execution metrics
 */
router.get('/metrics', validateToken, async (req: Request, res: Response) => {
  try {
    const metrics = codeExecutionService.getMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /metrics/reset
 * Reset execution metrics
 */
router.post('/metrics/reset', validateToken, async (req: Request, res: Response) => {
  try {
    codeExecutionService.resetMetrics();
    res.json({ reset: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /languages
 * Get supported languages
 */
router.get('/languages', async (req: Request, res: Response) => {
  res.json({ 
    languages: SUPPORTED_LANGUAGES,
    details: {
      javascript: { command: 'node', version: process.version },
      typescript: { command: 'tsx', runtime: 'node' },
      python: { command: 'python3' },
      bash: { command: 'bash' },
      shell: { command: 'bash', alias: 'bash' },
    }
  });
});

/**
 * POST /execute/quick
 * Quick execution with minimal config (convenience endpoint)
 */
router.post('/execute/quick', validateToken, async (req: Request, res: Response) => {
  try {
    const { language, code } = req.body;

    if (!language || !code) {
      return res.status(400).json({ error: 'language and code are required' });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ 
        error: `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }

    // Quick execution: 10s timeout, 100KB output, no network, no file write
    const result = await codeExecutionService.execute({
      language,
      code,
      timeout: 10000,
      maxOutput: 100 * 1024,
      allowNetwork: false,
      allowFileWrite: false,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /execute/repl
 * REPL-style execution (for interactive use)
 */
router.post('/execute/repl', validateToken, async (req: Request, res: Response) => {
  try {
    const { language, code, context } = req.body;

    if (!language || !code) {
      return res.status(400).json({ error: 'language and code are required' });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ 
        error: `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` 
      });
    }

    // Build context-aware code
    let wrappedCode = code;
    
    if (language === 'javascript' || language === 'typescript') {
      // Wrap in async context for top-level await
      wrappedCode = `(async () => { 
        try {
          const result = await (async () => { ${code} })();
          if (result !== undefined) console.log(result);
        } catch (e) {
          console.error(e.message);
          process.exit(1);
        }
      })();`;
    } else if (language === 'python') {
      // Add pretty printing for REPL
      wrappedCode = `
import sys
try:
    result = None
    exec('''${code.replace(/'/g, "\\'")}''')
    if result is not None:
        print(result)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
`;
    }

    const result = await codeExecutionService.execute({
      language,
      code: wrappedCode,
      timeout: 30000,
      maxOutput: 1024 * 1024,
      allowNetwork: false,
      allowFileWrite: false,
      env: context,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
