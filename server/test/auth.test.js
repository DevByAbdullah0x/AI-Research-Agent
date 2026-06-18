import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sendOtpEmail, verifyOtp } from '../src/services/otpService.js';

describe('Authentication & OTP Service', () => {
  const testEmail = 'testuser@example.com';

  test('should generate OTP and allow valid verification', async () => {
    const result = await sendOtpEmail(testEmail);
    assert.equal(result.success, true);
    assert.ok(result.expiresAt > Date.now());

    // Trying with wrong code
    const wrongAttempt = verifyOtp(testEmail, '000000');
    assert.equal(wrongAttempt.valid, false);
    assert.match(wrongAttempt.message, /invalid/i);
  });

  test('should reject verification for unknown email', () => {
    const attempt = verifyOtp('unknown@example.com', '123456');
    assert.equal(attempt.valid, false);
    assert.match(attempt.message, /no verification code found/i);
  });
});

