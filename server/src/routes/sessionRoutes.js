import { Router } from 'express';
import {
  listSessions,
  createSession,
  getSession,
  updateSession,
  deleteSession
} from '../controllers/sessionController.js';

const router = Router();

router.get('/sessions', listSessions);
router.post('/sessions', createSession);
router.get('/sessions/:id', getSession);
router.patch('/sessions/:id', updateSession);
router.delete('/sessions/:id', deleteSession);

export default router;

