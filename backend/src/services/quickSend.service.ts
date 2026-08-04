import crypto from 'crypto';
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

const GMAIL_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const EXPECTED_MAILBOX = 'infos@calkons.com';

export interface QuickSendRecipientInput {
  email: string;
  name?: string;
  customFields?: Record<string, string>;
}

interface GmailTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

class QuickSendService {
  private cachedAccessToken: { value: string; expiresAt: number } | null = null;

  getConnectionStatus() {
    return supabaseAdmin
      .from('quick_send_gmail_connections')
      .select('mailbox_email, connected_at, updated_at')
      .eq('mailbox_email', EXPECTED_MAILBOX)
      .maybeSingle();
  }

  getAuthorizationUrl(adminId: string): string {
    const clientId = this.requiredEnv('GMAIL_OAUTH_CLIENT_ID');
    const redirectUri = this.getRedirectUri();
    const state = this.signState({ adminId, expiresAt: Date.now() + 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: `${GMAIL_SCOPE} email`,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      login_hint: EXPECTED_MAILBOX,
      state,
    });
    return `${GMAIL_AUTHORIZE_URL}?${params.toString()}`;
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    const { adminId } = this.verifyState(state);
    const tokens = await this.requestTokens({
      code,
      client_id: this.requiredEnv('GMAIL_OAUTH_CLIENT_ID'),
      client_secret: this.requiredEnv('GMAIL_OAUTH_CLIENT_SECRET'),
      redirect_uri: this.getRedirectUri(),
      grant_type: 'authorization_code',
    });

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Google did not return the required Gmail OAuth tokens');
    }

    const profileResponse = await fetch(GMAIL_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    const profile = await profileResponse.json() as { email?: string };
    const mailbox = profile.email?.toLowerCase();
    if (!profileResponse.ok || mailbox !== EXPECTED_MAILBOX) {
      throw new Error(`Authorize the ${EXPECTED_MAILBOX} Google Workspace account`);
    }

    const { error } = await supabaseAdmin
      .from('quick_send_gmail_connections')
      .upsert({
        mailbox_email: EXPECTED_MAILBOX,
        encrypted_refresh_token: this.encrypt(tokens.refresh_token),
        connected_by: adminId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'mailbox_email' });
    if (error) throw new Error(`Failed to save Gmail connection: ${error.message}`);

    this.cachedAccessToken = {
      value: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
  }

  async disconnect(): Promise<void> {
    const { error } = await supabaseAdmin
      .from('quick_send_gmail_connections')
      .delete()
      .eq('mailbox_email', EXPECTED_MAILBOX);
    if (error) throw new Error(`Failed to disconnect Gmail: ${error.message}`);
    this.cachedAccessToken = null;
  }

  async createBatch(params: {
    category: string;
    subject: string;
    message: string;
    recipients: QuickSendRecipientInput[];
    pacingSeconds: number;
    createdBy: string;
  }): Promise<{ id: string; totalCount: number; suppressedCount: number }> {
    const uniqueRecipients = new Map<string, QuickSendRecipientInput>();
    for (const recipient of params.recipients) {
      const email = recipient.email.trim().toLowerCase();
      if (email && !uniqueRecipients.has(email)) {
        uniqueRecipients.set(email, { email, ...(recipient.name?.trim() && { name: recipient.name.trim() }) });
      }
    }

    const recipients = [...uniqueRecipients.values()];
    const emails = recipients.map(recipient => recipient.email);
    const { data: suppressions, error: suppressionError } = await supabaseAdmin
      .from('quick_send_suppressions')
      .select('email')
      .in('email', emails);
    if (suppressionError) throw new Error(`Failed to check suppressions: ${suppressionError.message}`);
    const suppressedEmails = new Set(
      (suppressions ?? []).map((row: { email: string }) => row.email.toLowerCase())
    );

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('quick_send_batches')
      .insert({
        category: params.category.trim(),
        subject: params.subject.trim(),
        message: params.message.trim(),
        total_count: recipients.length,
        suppressed_count: suppressedEmails.size,
        pacing_seconds: params.pacingSeconds,
        created_by: params.createdBy,
      })
      .select('id')
      .single();
    if (batchError || !batch) throw new Error(`Failed to create Quick Send batch: ${batchError?.message}`);

    const { error: recipientError } = await supabaseAdmin
      .from('quick_send_recipients')
      .insert(recipients.map(recipient => ({
        batch_id: batch.id,
        email: recipient.email,
        name: recipient.name ?? null,
        custom_fields: recipient.customFields ?? {},
        status: suppressedEmails.has(recipient.email) ? 'suppressed' : 'pending',
      })));
    if (recipientError) {
      await supabaseAdmin.from('quick_send_batches').delete().eq('id', batch.id);
      throw new Error(`Failed to queue recipients: ${recipientError.message}`);
    }

    return { id: batch.id, totalCount: recipients.length, suppressedCount: suppressedEmails.size };
  }

  async processBatch(batchId: string): Promise<void> {
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('quick_send_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    if (batchError || !batch) throw new Error(`Quick Send batch not found: ${batchId}`);

    await supabaseAdmin
      .from('quick_send_batches')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', batchId)
      .eq('status', 'queued');

    const { data: recipients, error: recipientError } = await supabaseAdmin
      .from('quick_send_recipients')
      .select('id, email, name, custom_fields')
      .eq('batch_id', batchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (recipientError) throw new Error(`Failed to load recipients: ${recipientError.message}`);

    let sentCount = 0;
    let failedCount = 0;
    for (let index = 0; index < (recipients ?? []).length; index += 1) {
      const recipient = recipients![index]!;
      const customFields = (recipient.custom_fields ?? {}) as Record<string, string>;

      // Substitute {{placeholders}} in subject and message per recipient
      const personalize = (text: string): string => {
        const firstName = recipient.name?.split(' ')[0]
          || customFields['firstName']
          || customFields['first_name']
          || customFields['name']
          || 'there';
        const lastName = recipient.name?.split(' ').slice(1).join(' ')
          || customFields['lastName']
          || customFields['last_name']
          || '';
        const defaults: Record<string, string> = {
          firstName,
          lastName,
          name: recipient.name || customFields['name'] || 'there',
          email: recipient.email,
          company: customFields['company'] || customFields['companyName'] || customFields['organization'] || '',
          ...customFields,
        };
        return text.replace(/\{\{(?:customField:)?([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) =>
          defaults[key] || defaults[key.charAt(0).toLowerCase() + key.slice(1)] || ''
        );
      };

      try {
        const messageId = await this.sendMessage({
          to: recipient.email,
          name: recipient.name ?? undefined,
          subject: personalize(batch.subject),
          message: personalize(batch.message),
          batchId,
        });
        sentCount += 1;
        await supabaseAdmin.from('quick_send_recipients').update({
          status: 'sent',
          gmail_message_id: messageId,
          sent_at: new Date().toISOString(),
        }).eq('id', recipient.id);
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : 'Unknown Gmail error';
        logger.error('Quick Send Gmail delivery failed', { batchId, recipient: recipient.email, error: message });
        await supabaseAdmin.from('quick_send_recipients').update({
          status: 'failed',
          error_message: message,
        }).eq('id', recipient.id);
      }

      await supabaseAdmin.from('quick_send_batches').update({
        sent_count: sentCount,
        failed_count: failedCount,
      }).eq('id', batchId);

      if (index < recipients!.length - 1) {
        await new Promise(resolve => setTimeout(resolve, Number(batch.pacing_seconds) * 1000));
      }
    }

    const finalStatus = failedCount === 0 ? 'completed' : sentCount > 0 ? 'partial_failed' : 'failed';
    await supabaseAdmin.from('quick_send_batches').update({
      status: finalStatus,
      sent_count: sentCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    }).eq('id', batchId);
  }

  async listBatches(limit: number) {
    return supabaseAdmin
      .from('quick_send_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  async listRecipients(batchId: string) {
    return supabaseAdmin
      .from('quick_send_recipients')
      .select('id, email, name, status, gmail_message_id, error_message, sent_at, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
  }

  async unsubscribe(email: string, token: string, batchId?: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!this.verifyUnsubscribeToken(normalizedEmail, token)) return false;
    const { error } = await supabaseAdmin.from('quick_send_suppressions').upsert({
      email: normalizedEmail,
      reason: 'unsubscribed',
      source: 'recipient',
      batch_id: batchId ?? null,
    }, { onConflict: 'email' });
    if (error) throw new Error(`Failed to unsubscribe: ${error.message}`);
    return true;
  }

  private async sendMessage(params: {
    to: string;
    name?: string;
    subject: string;
    message: string;
    batchId: string;
  }): Promise<string> {
    const accessToken = await this.getAccessToken();
    const unsubscribeToken = this.createUnsubscribeToken(params.to);
    const apiUrl = (process.env['API_PUBLIC_URL'] || '').replace(/\/$/, '');
    const optOutUrl = `${apiUrl}/api/v1/quick-send/unsubscribe?email=${encodeURIComponent(params.to)}&batch=${encodeURIComponent(params.batchId)}&token=${encodeURIComponent(unsubscribeToken)}`;
    const html = this.buildHtml(params.message, optOutUrl);
    const text = `${params.message}\n\n---\nNot interested? Remove yourself from this list:\n${optOutUrl}`;
    const raw = this.buildMimeMessage({ ...params, html, text });

    const response = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok || !result.id) {
      throw new Error(result.error?.message || `Gmail API returned HTTP ${response.status}`);
    }
    return result.id;
  }

  private buildMimeMessage(params: {
    to: string;
    name?: string;
    subject: string;
    html: string;
    text: string;
  }): string {
    const boundary = `quick-send-${crypto.randomBytes(12).toString('hex')}`;
    const displayName = params.name ? `${this.cleanHeader(params.name)} <${params.to}>` : params.to;
    const subject = `=?UTF-8?B?${Buffer.from(this.cleanHeader(params.subject)).toString('base64')}?=`;
    const mime = [
      `From: DriveDrop <${EXPECTED_MAILBOX}>`,
      `To: ${displayName}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(params.text).toString('base64'),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(params.html).toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');
    return Buffer.from(mime).toString('base64url');
  }

  private buildHtml(message: string, optOutUrl: string): string {
    // Paragraph-aware rendering: blank lines → paragraph breaks
    const paragraphs = message
      .split(/\r?\n\s*\r?\n/)
      .map(p => `<p style="margin:0 0 16px">${this.escapeHtml(p.trim()).replace(/\r?\n/g, '<br>')}</p>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#030712;padding:32px 40px;text-align:center;">
            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Drive<span style="color:#3b82f6;">Drop</span></h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
            <p style="margin:0 0 8px;"><a href="https://drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">drivedrop.us.com</a>&nbsp;&middot;&nbsp;<a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a></p>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} DriveDrop Inc. &middot; Charlotte, NC</p>
            <p style="margin:0;"><a href="${optOutUrl}" style="color:#9ca3af;font-size:11px;text-decoration:underline;">Not interested? Remove me from this list</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt > Date.now() + 60_000) {
      return this.cachedAccessToken.value;
    }

    const { data, error } = await supabaseAdmin
      .from('quick_send_gmail_connections')
      .select('encrypted_refresh_token')
      .eq('mailbox_email', EXPECTED_MAILBOX)
      .single();
    if (error || !data) throw new Error(`Connect ${EXPECTED_MAILBOX} before sending`);

    const tokens = await this.requestTokens({
      client_id: this.requiredEnv('GMAIL_OAUTH_CLIENT_ID'),
      client_secret: this.requiredEnv('GMAIL_OAUTH_CLIENT_SECRET'),
      refresh_token: this.decrypt(data.encrypted_refresh_token),
      grant_type: 'refresh_token',
    });
    if (!tokens.access_token) throw new Error('Google did not return a Gmail access token');
    this.cachedAccessToken = {
      value: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    return tokens.access_token;
  }

  private async requestTokens(params: Record<string, string>): Promise<GmailTokenResponse> {
    const response = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as GmailTokenResponse;
    if (!response.ok) throw new Error(result.error_description || result.error || 'Google OAuth failed');
    return result;
  }

  private getRedirectUri(): string {
    return `${this.requiredEnv('API_PUBLIC_URL').replace(/\/$/, '')}/api/v1/quick-send/oauth/callback`;
  }

  private signState(payload: { adminId: string; expiresAt: number }): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', this.requiredEnv('QUICK_SEND_OAUTH_STATE_SECRET'))
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyState(state: string): { adminId: string; expiresAt: number } {
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) throw new Error('Invalid OAuth state');
    const expected = crypto.createHmac('sha256', this.requiredEnv('QUICK_SEND_OAUTH_STATE_SECRET'))
      .update(encoded)
      .digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new Error('Invalid OAuth state');
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as { adminId: string; expiresAt: number };
    if (!payload.adminId || payload.expiresAt < Date.now()) throw new Error('OAuth state expired');
    return payload;
  }

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
  }

  private decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) throw new Error('Stored Gmail token is invalid');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private encryptionKey(): Buffer {
    return crypto.createHash('sha256').update(this.requiredEnv('GMAIL_TOKEN_ENCRYPTION_KEY')).digest();
  }

  private createUnsubscribeToken(email: string): string {
    return crypto.createHmac('sha256', this.requiredEnv('QUICK_SEND_UNSUBSCRIBE_SECRET'))
      .update(email.toLowerCase())
      .digest('base64url');
  }

  private verifyUnsubscribeToken(email: string, token: string): boolean {
    const expected = this.createUnsubscribeToken(email);
    const actualBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  }

  private cleanHeader(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').trim();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const quickSendService = new QuickSendService();