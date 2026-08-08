# Quick Send Gmail Setup

Quick Send is an admin-only batch sender for pasted recipient lists. It sends only through the Gmail API as `infos@calkons.com`. The FMCSA carrier campaign system continues to use Brevo and is not connected to these routes or tables.

## 1. Apply the migration

Apply `supabase/migrations/20260731_quick_send_gmail.sql` to the production Supabase project.

The migration creates only these tables:

- `quick_send_gmail_connections`
- `quick_send_batches`
- `quick_send_recipients`
- `quick_send_suppressions`

## 2. Configure Google Cloud

1. Open the Google Cloud project that will own the Gmail integration.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen. Internal user type is appropriate when the Cloud project belongs to the same Google Workspace organization as `calkons.com`; otherwise use External and add Benson as a test user until the app is published.
4. Add the Gmail send scope: `https://www.googleapis.com/auth/gmail.send`.
5. Create an OAuth client with application type **Web application**.
6. Add this authorized redirect URI exactly:

   `https://YOUR-BACKEND-HOST/api/v1/quick-send/oauth/callback`

The origin must match `API_PUBLIC_URL`. Do not add a trailing slash to that environment value.

## 3. Configure backend environment

Set these variables in Railway/backend production:

```env
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...
GMAIL_TOKEN_ENCRYPTION_KEY=...
API_PUBLIC_URL=https://YOUR-BACKEND-HOST
FRONTEND_URL=https://www.drivedrop.us.com
```

Generate each secret independently. For example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not reuse `BREVO_WEBHOOK_SECRET` or any Gmail password. The refresh token is encrypted with AES-256-GCM before it is stored in Supabase.

## 4. Authorize once

1. Deploy the migration, backend, and website.
2. Sign in to DriveDrop as an administrator.
3. Open `/dashboard/admin/quick-send`.
4. Select **Connect** beside `infos@calkons.com`.
5. Benson signs in to `infos@calkons.com` and grants Gmail send access.
6. Google returns to Quick Send and the mailbox status changes to **Gmail connected**.

The backend rejects authorization from any mailbox other than `infos@calkons.com`.

## 5. Verify safely

1. Queue a one-recipient batch to an address controlled by the team.
2. Confirm the message appears in the `infos@calkons.com` Sent folder.
3. Confirm the Quick Send history shows the Gmail message ID.
4. Follow the unsubscribe link, then try a second batch to the same address. It should be recorded as suppressed and not sent.
5. Run an FMCSA campaign test separately and confirm it still appears in Brevo. Quick Send does not import or call `campaignManagerService`, `outreachOrchestrator`, or `brevoOutreachService`.

## Operational Notes

- A batch accepts up to 500 unique recipients.
- Pacing is configurable from 1 to 300 seconds between messages.
- Recipients may be pasted as `email@example.com` or `Name <email@example.com>`, separated by lines, commas, or semicolons.
- Gmail API message IDs, failures, categories, counts, and timestamps are retained in Quick Send history.
- Disconnecting removes the stored refresh token. It does not revoke access in Google Account settings; revoke there as well when permanently decommissioning the integration.