import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import crypto from 'node:crypto';
import { database } from '../db/database.js';

let resendClient = null;
let smtpTransporter = null;

function getSmtpTransporter() {
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : null;

  if (user && pass) {
    if (!smtpTransporter) {
      smtpTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
    }
    return smtpTransporter;
  }
  return null;
}

function getResendClient() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      resendClient = new Resend(key);
    }
  }
  return resendClient;
}

// In-memory OTP cache for instant lookup + fallback
const otpCache = new Map();

// Helper to hash OTP code for safe storage
function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

/**
 * Generate and dispatch a 6-digit OTP to the user's email via Gmail SMTP (or Resend fallback)
 */
export async function sendOtpEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  
  // Generate random 6-digit numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashOtp(code);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Persist in Firestore database AND memory cache
  try {
    await database.saveOtp(normalizedEmail, codeHash, expiresAt);
  } catch (err) {
    console.warn('[OTP] Failed to persist OTP to DB:', err.message);
  }
  otpCache.set(normalizedEmail, { codeHash, expiresAt });

  console.log(`[OTP] Generated 6-digit code for ${normalizedEmail}: ${code} (expires in 5 min)`);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e7e5e4;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 700; color: #1c1917;">🔬 AI Research Agent</span>
      </div>
      <h2 style="font-size: 22px; font-weight: 600; color: #1c1917; margin: 0 0 12px 0;">Verify your email address</h2>
      <p style="font-size: 15px; color: #57534e; line-height: 1.5; margin: 0 0 24px 0;">
        Thank you for registering. Use the 6-digit verification code below to complete your account setup:
      </p>
      <div style="background: #f5f5f4; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0c0a09;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #78716c; margin: 0 0 8px 0;">
        ⏱️ This code will expire in <strong>5 minutes</strong>.
      </p>
      <p style="font-size: 13px; color: #a8a29e; margin: 0;">
        If you didn't request this verification code, you can safely ignore this email.
      </p>
    </div>
  `;

  let emailSent = false;
  let deliveryError = null;

  // 1. Try Gmail SMTP via Nodemailer first (Delivers to ANY recipient without custom domain restrictions)
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const smtpUser = process.env.SMTP_USER || 'iabdullahtariq.7@gmail.com';
      const info = await transporter.sendMail({
        from: `"AI Research Agent" <${smtpUser}>`,
        to: normalizedEmail,
        subject: `${code} is your AI Research Agent verification code`,
        html: htmlContent
      });
      console.log('[OTP] Email dispatched successfully via Gmail SMTP:', info.messageId);
      emailSent = true;
    } catch (err) {
      console.warn('[OTP] Gmail SMTP sending failed, attempting Resend fallback:', err.message);
      deliveryError = err.message;
    }
  }

  // 2. If SMTP wasn't sent, try Resend as fallback
  if (!emailSent) {
    const resend = getResendClient();
    if (resend) {
      try {
        const fromAddress = process.env.RESEND_FROM || 'AI Research Agent <onboarding@resend.dev>';
        const { data, error } = await resend.emails.send({
          from: fromAddress,
          to: [normalizedEmail],
          subject: `${code} is your AI Research Agent verification code`,
          html: htmlContent
        });

        if (error) {
          console.warn('[OTP] Resend fallback error:', error);
          deliveryError = error.message;
        } else {
          console.log('[OTP] Email dispatched successfully via Resend:', data?.id);
          emailSent = true;
          deliveryError = null;
        }
      } catch (err) {
        console.error('[OTP] Resend fallback failed:', err.message);
        deliveryError = err.message;
      }
    }
  }

  return {
    success: true,
    emailSent,
    expiresAt,
    deliveryError
  };
}

/**
 * Verify a submitted 6-digit OTP code
 */
export async function verifyOtp(email, submittedCode) {
  const normalizedEmail = email.trim().toLowerCase();
  
  // 1. Check in-memory cache first
  let record = otpCache.get(normalizedEmail);

  // 2. If not in memory (e.g. server restarted or cold start), check Firestore DB
  if (!record) {
    try {
      const dbRow = await database.getOtp(normalizedEmail);
      if (dbRow) {
        record = {
          codeHash: dbRow.code_hash,
          expiresAt: Number(dbRow.expires_at)
        };
      }
    } catch (err) {
      console.warn('[OTP] Failed to query OTP from DB:', err.message);
    }
  }

  if (!record) {
    return { valid: false, message: 'No verification code found for this email. Please request a new one.' };
  }

  if (Date.now() > record.expiresAt) {
    otpCache.delete(normalizedEmail);
    try { await database.deleteOtp(normalizedEmail); } catch {}
    return { valid: false, message: 'Verification code has expired. Please request a new one.' };
  }

  const submittedHash = hashOtp(submittedCode);
  if (submittedHash !== record.codeHash) {
    return { valid: false, message: 'Invalid verification code. Please check and try again.' };
  }

  // Code is valid! Invalidate immediately so it cannot be reused
  otpCache.delete(normalizedEmail);
  try { await database.deleteOtp(normalizedEmail); } catch {}
  return { valid: true };
}
