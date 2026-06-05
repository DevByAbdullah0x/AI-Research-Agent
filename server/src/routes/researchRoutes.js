import { Router } from 'express';
import { research, streamResearch } from '../controllers/researchController.js';

const router = Router();
router.post('/research', research);
router.post('/research/stream', streamResearch);
export default router;
