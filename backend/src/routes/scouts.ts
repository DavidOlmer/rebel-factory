import { Router } from 'express';
import { ScoutService, ScoutType } from '../services/scout.service';
import { pool } from '../db/client';

const router = Router();
const scoutService = new ScoutService(pool);

// Run scouts for an agent
router.post('/:agentId/scout', async (req, res) => {
  const { agentId } = req.params;
  const { types = ['quality-scout', 'drift-scout', 'cost-scout'] } = req.body;
  
  const results = await scoutService.runScouts(agentId, types as ScoutType[]);
  const synthesis = scoutService.synthesize(results);
  
  res.json({ results, synthesis });
});

export default router;
