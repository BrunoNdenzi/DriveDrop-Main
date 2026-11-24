# Sellbird to BenjiGo Production Rollout

This integration records a Sellbird prospect only after the prospect accepts the outreach offer. It does not create a BenjiGo account, route, subscription, or email. It returns the existing Route Planner signup URL, and the database links the accepted lead to the matching profile after signup.

## Components

- BenjiGo endpoint: `POST /api/v1/integrations/sellbird/accepted-leads`
- Database migration: `backend/migrations/create_sellbird_accepted_leads.sql`
- Sellbird MCP adapter: `scripts/benjigo_handoff.py` in the Sellbird checkout
- Sellbird tool: `accept_sellbird_lead`
- Authentication: a dedicated bearer secret, separate from Supabase user tokens and integration credentials
- Idempotency: SHA-256 of the normalized prospect email, prefixed with `sellbird:`

## Deploy Order

### 1. Apply the Supabase migration

Run the contents of `backend/migrations/create_sellbird_accepted_leads.sql` against the production Supabase project once. It creates:

- `public.sellbird_accepted_leads`
- a unique `idempotency_key`
- row-level security with no public policy
- conversion linkage to `public.profiles`
- triggers that handle both signup-after-acceptance and acceptance-after-signup

Confirm the table exists before deploying the backend. Do not add an anonymous insert policy; the Railway backend writes with the service-role client.

### 2. Create the shared secret

Generate at least 32 random bytes locally. Do not paste the value into chat, source control, logs, command history, or a URL.

Set the same value in these two places:

- Railway: `SELLBIRD_INTEGRATION_SECRET`
- the local Sellbird `.env`: `BENJIGO_SELLBIRD_SECRET`

Leave Railway `SELLBIRD_INTEGRATION_SECRET_PREVIOUS` empty for the first deployment. Sellbird's API base is:

```dotenv
BENJIGO_API_URL=https://drivedrop-main-production.up.railway.app/api/v1
```

Also confirm Railway `FRONTEND_URL=https://drivedrop.us.com`, because the endpoint uses it to build the onboarding URL.

### 3. Deploy the Railway backend

Deploy the backend commit containing the migration contract, service, route, and route registration. The new endpoint should return:

- `401` with no bearer token or an incorrect token
- `400` for a missing/invalid email or idempotency key
- `200` for a valid accepted lead
- the same database row for a repeated idempotency key

No Vercel deployment is required specifically for this integration. It uses the existing `/signup?role=client&product=route-planner&source=sellbird` page and deliberately does not put the prospect's email in the URL.

### 4. Smoke-test through the MCP adapter

Activate Sellbird's trusted virtual environment, make sure its `.env` has the production secret, then run the focused tests:

```powershell
& "$env:LOCALAPPDATA\Sellbird\venv\Scripts\Activate.ps1"
python -m pytest -q tests\test_benjigo_handoff.py tests\test_handoff.py
```

For one live smoke test, use a mailbox you own and invoke the MCP tool through an accepted-offer test conversation. Verify only these facts:

1. Sellbird stores a successful handoff result.
2. Supabase contains one accepted-lead row.
3. Replaying the same handoff updates `last_received_at` without adding a row.
4. The returned signup link opens the Route Planner signup flow.
5. Signing up with the same email fills `converted_user_id` and `converted_at`.

Do not use a real prospect for this smoke test.

## Secret Rotation

Rotate without downtime in this order:

1. Put the current Railway value in `SELLBIRD_INTEGRATION_SECRET_PREVIOUS`.
2. Put a new value in Railway `SELLBIRD_INTEGRATION_SECRET` and deploy/restart.
3. Replace local Sellbird `BENJIGO_SELLBIRD_SECRET` with the new value.
4. Verify one handoff.
5. Clear Railway `SELLBIRD_INTEGRATION_SECRET_PREVIOUS` and restart.

## Sellbird Go-Live Gates

Product knowledge and the BenjiGo ICP are configured locally. Keep `channels.email.require_approval: true` through at least the first two reviewed batches.

Before outreach can run in production, complete all of the following:

- Set `persona.email` to the dedicated sending mailbox.
- Configure and authenticate exactly one email provider. For Gmail, add the OAuth client values and run `sellbird gmail auth`, then `sellbird gmail test`.
- Warm the dedicated secondary sending domain. Connect TrulyInbox with `sellbird trulyinbox connect`, or record another provider with `sellbird trulyinbox other`; check with `sellbird warmup`.
- Add at least one verifier key. Without Reoon, ZeroBounce, or Hunter, guessed addresses are not sent.
- Set `compliance.postal_address` to a valid address that can receive mail.
- Decide whether to enable Precleared and set the sender/prospect country fields.
- Review the first-email offer in `sellbird.yaml`; it currently offers an optimized comparison of one real route.
- Confirm only relevant signals. A focused initial set is `HIRING_ROLE,OPEN_ROLES,CONTACT_FOUND`; review them in the dashboard before confirming.
- Build a cohort around target industries, decision-maker title, and evidence of active delivery/dispatch hiring.
- Run discovery with `--estimate` first and set an explicit maximum spend for paid providers.
- Review every draft and verify any claim about a prospect's website before approval.

Do not enable autopilot during rollout. Do not start the heartbeat until the mailbox, warmup, verification, compliance, and signal choices are complete.

## Local Validation

The implementation has dedicated checks that do not call Claude or Codex:

```powershell
cd backend
npm run test:sellbird-integration
npm run type-check
```

The Sellbird handoff checks are the two pytest files shown above. These tests use only fictional `example.com` data and mocked HTTP calls.