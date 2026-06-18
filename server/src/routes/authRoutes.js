import { Router } from 'express';
import { sendRegistrationOtp, verifyAndRegister, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/send-registration-otp', sendRegistrationOtp);
router.post('/verify-and-register', verifyAndRegister);
router.get('/me', requireAuth, getMe);

export default router;

