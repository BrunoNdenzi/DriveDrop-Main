import type { Request, Response } from 'express';
import { twilioService } from '../services/twilio.service';
import { logger } from '@utils/logger';
import { normalizePhoneToE164 } from '@utils/phone';

interface PhoneOwnerRow {
  id: string;
  phone: string | null;
  role: string | null;
  is_guest: boolean | null;
}

async function findPhoneOwners(phone: string): Promise<PhoneOwnerRow[]> {
  const { supabaseAdmin } = await import('../lib/supabase');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, phone, role, is_guest')
    .not('phone', 'is', null);
  if (error) throw error;
  return ((data ?? []) as PhoneOwnerRow[]).filter(profile =>
    normalizePhoneToE164(String(profile.phone ?? '')) === phone
  );
}

async function assertPhoneAvailable(phone: string, userId?: string): Promise<void> {
  const owners = await findPhoneOwners(phone);
  const conflict = owners.find(owner => owner.id !== userId && !owner.is_guest);
  if (conflict) throw new Error('This phone number is already linked to another account');
}

export async function sendPhoneOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };
  const normalizedPhone = normalizePhoneToE164(phone ?? '');
  if (!normalizedPhone) {
    res.status(400).json({ error: 'A valid US or E.164 phone number is required' });
    return;
  }

  try {
    await twilioService.sendVerificationCode({ to: normalizedPhone, channel: 'sms' });
    res.json({ success: true, phone: normalizedPhone });
  } catch (err: any) {
    logger.error('[PHONE_OTP] Send error', { err });
    res.status(500).json({ error: err.message || 'Failed to send verification code' });
  }
}

export async function verifyPhoneOtp(req: Request, res: Response): Promise<void> {
  const { phone, code, userId } = req.body as { phone?: string; code?: string; userId?: string };
  const normalizedPhone = normalizePhoneToE164(phone ?? '');

  if (!normalizedPhone || !code || !userId) {
    res.status(400).json({ error: 'Valid phone, code, and user ID are required' });
    return;
  }

  try {
    const { supabaseAdmin } = await import('../lib/supabase');
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .maybeSingle();
    if (!profile || normalizePhoneToE164(String(profile.phone ?? '')) !== normalizedPhone) {
      res.status(409).json({ error: 'The verified number does not match this account' });
      return;
    }

    await assertPhoneAvailable(normalizedPhone, userId);
    const valid = await twilioService.verifyPhoneNumber({ to: normalizedPhone, code });

    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    await supabaseAdmin
      .from('profiles')
      .update({ phone: normalizedPhone, phone_verified_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ success: true, phone: normalizedPhone });
  } catch (err: any) {
    logger.error('[PHONE_OTP] Verify error', { err });
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
}

export async function sendPhoneChangeOtp(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const normalizedPhone = normalizePhoneToE164(String(req.body?.phone ?? ''));
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!normalizedPhone) {
    res.status(400).json({ error: 'A valid US or E.164 phone number is required' });
    return;
  }

  try {
    await assertPhoneAvailable(normalizedPhone, userId);
    await twilioService.sendVerificationCode({ to: normalizedPhone, channel: 'sms' });
    res.json({ success: true, phone: normalizedPhone });
  } catch (err) {
    logger.error('[PHONE_CHANGE] Send error', { err, userId });
    res.status(409).json({ error: err instanceof Error ? err.message : 'Failed to send verification code' });
  }
}

export async function verifyPhoneChangeOtp(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const normalizedPhone = normalizePhoneToE164(String(req.body?.phone ?? ''));
  const code = String(req.body?.code ?? '').trim();
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!normalizedPhone || !/^\d{4,10}$/.test(code)) {
    res.status(400).json({ error: 'A valid phone number and verification code are required' });
    return;
  }

  try {
    const valid = await twilioService.verifyPhoneNumber({ to: normalizedPhone, code });
    if (!valid) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    const { supabaseAdmin } = await import('../lib/supabase');
    const owners = await findPhoneOwners(normalizedPhone);
    const conflict = owners.find(owner => owner.id !== userId && !owner.is_guest);
    if (conflict) {
      res.status(409).json({ error: 'This phone number is already linked to another account' });
      return;
    }

    for (const guest of owners.filter(owner => owner.id !== userId && owner.is_guest)) {
      const { count, error: shipmentError } = await supabaseAdmin
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .or(`client_id.eq.${guest.id},driver_id.eq.${guest.id}`);
      if (shipmentError) throw shipmentError;
      if ((count ?? 0) > 0) {
        res.status(409).json({ error: 'This number has guest activity that support must merge first' });
        return;
      }
      await supabaseAdmin.from('benji_sessions').delete().eq('user_id', guest.id);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(guest.id);
      if (deleteError) throw deleteError;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      phone: normalizedPhone,
      phone_confirm: true,
    });
    if (authError) throw authError;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: normalizedPhone,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (profileError) throw profileError;

    await v3SessionStoreCleanup(normalizedPhone);
    res.json({ success: true, phone: normalizedPhone });
  } catch (err) {
    logger.error('[PHONE_CHANGE] Verify error', { err, userId });
    res.status(500).json({ error: err instanceof Error ? err.message : 'Verification failed' });
  }
}

async function v3SessionStoreCleanup(phone: string): Promise<void> {
  const { v3SessionStore } = await import('../benji-v3/benji.memory');
  await v3SessionStore.delete(`sms:${phone}`);
}
