import type { Request, Response } from 'express';
import { twilioService } from '../services/twilio.service';
import { logger } from '@utils/logger';

export async function sendPhoneOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    res.status(400).json({ error: 'Phone number required' });
    return;
  }

  try {
    await twilioService.sendVerificationCode({ to: phone, channel: 'sms' });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[PHONE_OTP] Send error', { err });
    res.status(500).json({ error: err.message || 'Failed to send verification code' });
  }
}

export async function verifyPhoneOtp(req: Request, res: Response): Promise<void> {
  const { phone, code, userId } = req.body as { phone?: string; code?: string; userId?: string };

  if (!phone || !code) {
    res.status(400).json({ error: 'Phone and code required' });
    return;
  }

  try {
    const valid = await twilioService.verifyPhoneNumber({ to: phone, code });

    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    // Mark phone as verified in profile
    if (userId) {
      const { supabaseAdmin } = await import('../lib/supabase');
      await supabaseAdmin
        .from('profiles')
        .update({ phone_verified_at: new Date().toISOString() })
        .eq('id', userId);
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[PHONE_OTP] Verify error', { err });
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
}
