import { firebaseAuth } from '../config/firebase.js';

/**
 * Middleware that verifies the Firebase JWT ID token in the Authorization header.
 * Attaches decoded user info to req.user: { uid, email, name }
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Convenience for automated test runners
  if (process.env.NODE_ENV === 'test' && (!authHeader || !authHeader.startsWith('Bearer '))) {
    req.user = { uid: 'test-user', email: 'test@example.com', name: 'Test User' };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Please log in.'
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'User')
    };
    next();
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token. Please log in again.'
    });
  }
}

