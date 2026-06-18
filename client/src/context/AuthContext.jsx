import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Get fresh Firebase JWT token for API requests
   */
  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(forceRefresh);
  }, []);

  /**
   * Log in with Email & Password
   */
  const loginWithEmail = async (email, password) => {
    setAuthError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      return { success: true, user: cred.user };
    } catch (err) {
      let message = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again in a few minutes.';
      }
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  /**
   * 1-Click Google Sign In
   */
  const loginWithGoogle = async () => {
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return { success: true, user: cred.user };
    } catch (err) {
      let message = 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        message = ''; // User dismissed popup, no error needed
      } else if (err.message) {
        message = err.message;
      }
      if (message) setAuthError(message);
      return { success: false, error: message };
    }
  };

  /**
   * Request 6-digit registration OTP via Resend
   */
  const sendRegistrationOtp = async (email) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to send verification code.');
      }
      return { success: true, expiresAt: data.expiresAt };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Verify OTP and complete registration
   */
  const verifyOtpAndRegister = async (email, password, otp) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/verify-and-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          otp: otp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Verification failed.');
      }

      // Automatically sign in using the returned custom token
      if (data.customToken) {
        const cred = await signInWithCustomToken(auth, data.customToken);
        return { success: true, user: cred.user };
      }

      // Fallback: regular sign in with password
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      return { success: true, user: cred.user };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Sign out
   */
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        getIdToken,
        loginWithEmail,
        loginWithGoogle,
        sendRegistrationOtp,
        verifyOtpAndRegister,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

