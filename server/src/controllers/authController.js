import { firebaseAuth } from '../config/firebase.js';
import { sendOtpEmail, verifyOtp } from '../services/otpService.js';

/**
 * Step 1 of Registration: Validate email doesn't exist, generate & send 6-digit OTP
 */
export async function sendRegistrationOtp(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists in Firebase
    try {
      const existingUser = await firebaseAuth.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already registered',
          message: 'An account with this email already exists. Please sign in instead.'
        });
      }
    } catch (err) {
      // auth/user-not-found means the email is available, which is what we want
      if (err.code !== 'auth/user-not-found') {
        console.error('[Auth] Error checking existing user:', err);
      }
    }

    // Send OTP via Resend
    const result = await sendOtpEmail(normalizedEmail);

    if (!result.emailSent && result.deliveryError) {
      return res.status(400).json({
        error: 'Email delivery failed',
        message: result.deliveryError
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email address.',
      expiresAt: result.expiresAt
    });
  } catch (err) {
    console.error('[Auth] sendRegistrationOtp error:', err);
    return res.status(500).json({
      error: 'Failed to send verification code',
      message: err.message
    });
  }
}

/**
 * Step 2 of Registration: Verify 6-digit OTP and create user in Firebase Auth
 */
export async function verifyAndRegister(req, res) {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password || !otp) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and 6-digit verification code are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password too weak',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify OTP
    const verification = await verifyOtp(normalizedEmail, otp);
    if (!verification.valid) {
      return res.status(400).json({
        error: 'Invalid code',
        message: verification.message
      });
    }

    // 2. Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await firebaseAuth.createUser({
        email: normalizedEmail,
        password: password,
        emailVerified: true
      });
    } catch (firebaseErr) {
      if (firebaseErr.code === 'auth/email-already-exists') {
        return res.status(409).json({
          error: 'Email already registered',
          message: 'An account with this email was already created. Please sign in.'
        });
      }
      throw firebaseErr;
    }

    // 3. Generate a custom token so client can immediately sign in with Firebase SDK
    const customToken = await firebaseAuth.createCustomToken(userRecord.uid);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: {
        uid: userRecord.uid,
        email: userRecord.email
      },
      customToken
    });
  } catch (err) {
    console.error('[Auth] verifyAndRegister error:', err);
    return res.status(500).json({
      error: 'Registration failed',
      message: err.message
    });
  }
}

/**
 * Get current authenticated user profile
 */
export function getMe(req, res) {
  return res.status(200).json({ user: req.user });
}

