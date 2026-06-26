import { Router } from 'express';
import {
  listResearchRuns,
  getResearchRun,
  rerunResearch,
  deleteResearchRun
} from '../controllers/researchHistoryController.js';

const router = Router();

router.get('/research/runs', listResearchRuns);
router.get('/research/runs/:id', getResearchRun);
router.post('/research/runs/:id/rerun', rerunResearch);
router.delete('/research/runs/:id', deleteResearchRun);

export default router;

