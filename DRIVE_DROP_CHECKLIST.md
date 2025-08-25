# DriveDrop — Detailed Interactive Checklist

How to use this file
- Each row is a Task with a unique Task ID (T001, T002, ...).
- For every Task you will find: Purpose, Exact Agent Commands, Expected Output, Verification Steps, Rollback Steps, Estimated Time, Priority.
- The agent must follow the commands exactly and report results as specified in the Plan.
- After the agent finishes a Task, you must approve ("Approve"), ask for changes ("Iterate") or cancel ("Abort").

Legend
- Cmd: exact shell commands to run (run from repo root unless otherwise specified)
- Verify: commands to confirm success
- Rollback: commands to revert changes if needed

----------------------------------------
PHASE 0 — PREPARE (local env & tools)
----------------------------------------
T000 — Install local tools (developer)
Purpose: Ensure dev machine has required tooling
Commands (run manually or agent can run if authorized):
- node: verify: node -v (>=18)
- npm/yarn: npm -v | yarn -v
- Docker: docker --version
- Supabase CLI: supabase --version
- Expo & EAS: npm install -g expo-cli eas-cli && expo --version && eas --version

Verify:
- node -v shows v18.x or higher
- docker running

Notes:
- This is a preparatory task. The agent may request to continue only after verification.

----------------------------------------
PHASE 1 — REPO AUDIT & SMOKE RUN
----------------------------------------
T001 — Repo audit: lint, type-check, npm audit, run backend & mobile smoke
Purpose: Identify blocking TypeScript, lint, and runtime issues
Mode: Agent runs and reports only (no commits)
Commands:
1. Backend install
- cd backend
- npm ci
- npm run lint
- npm run type-check
- npm test -- --watchAll=false --coverage=false
2. Mobile install
- cd ../mobile
- npm ci
- npm run lint
- npm run type-check
- npm start -- --offline (or expo start --tunnel) — just start the server and ensure it boots

Expected output:
- Lint: zero (or list of errors/warnings)
- Type-check: zero errors (or list)
- Tests: show failures if any, full stack traces

Verification:
- Provide full stdout/stderr for each command
- Provide a concise list of blocking items and their filenames
- Provide "git status" before and after (should be clean, no local uncommitted changes)

Rollback:
- No changes expected. If agent modifies files accidentally: git restore --source=HEAD --staged . && git restore --source=HEAD .

Estimated time: 30–90 minutes depending on number of errors.
Priority: High

Acceptance Criteria:
- Complete audit report with error counts and top 10 issues prioritized.

----------------------------------------
PHASE 2 — QUICK WINS (Lint/Type fixes)
----------------------------------------
T002 — Auto-fix lint & simple TypeScript issues
Purpose: Apply non-invasive fixes (formatting, auto-fixable ESLint)
Mode: Agent must propose changes as a patch and not push. After user approval the agent will commit to feature branch (Mode A) or provide patch (Mode B).
Commands:
- cd backend
- npm run lint -- --fix
- npm run type-check
- git checkout -b feat/T002-lint-fixes
- git add -A
- git commit -m "[T002] eslint/formatting auto-fixes"
- git status
- git diff --staged

Expected output:
- eslint auto-fixed issues updated files list
- type-check should still be clean or report remaining non-auto-fix issues

Verify:
- Provide git diff and list of files changed
- Provide failing type-check errors if any

Rollback:
- git reset --hard HEAD~1 && git checkout main

Estimated time: 30–120 minutes
Priority: High (depends on T001)

----------------------------------------
PHASE 3 — DATABASE & SUPABASE
----------------------------------------
T003 — Standardize UUID functions & ensure required extensions
Purpose: Ensure schema uses a consistent uuid generator and that required Postgres extensions (pgcrypto or uuid-ossp, postgis) are enabled.
Mode: Agent produces SQL migration suggestions (do not apply to production until user approves).
Commands (example SQL snippets agent must produce and present, not run):
- -- If using pgcrypto:
- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
- -- Replace uuid_generate_v4 usage with gen_random_uuid() or vice versa (decide on standard)
- Provide SQL migration file content and path: supabase/migrations/<timestamp>_standardize_uuid.sql
Verify:
- Provide diff between schema.sql and migration
- Provide exact SQL to run locally: supabase db push (after linking project)
Rollback:
- DROP EXTENSION should not be used in rollback; instead provide reverse migration if required
Estimated time: 60–180 minutes
Priority: High

T004 — Validate user-defined types referenced in schema
Purpose: Ensure every USER-DEFINED type referenced in schema exists in migrations (e.g., payment_status, shipment_status, user_role, location type).
Commands:
- Search for types: grep -R "USER-DEFINED" -n supabase || use repo search in backend types
- Create SQL migrations for missing types:
  - CREATE TYPE payment_status AS ENUM ('pending','completed','failed','refunded');
  - (list all types needed)
Verify:
- Show SQL migration files and `supabase db push` plan (do not push without approval)
Rollback:
- Provide DROP TYPE or ALTER TYPE migration for production rollback
Estimated time: 60–180 minutes
Priority: High

T005 — Supabase RLS policy review & sample policies
Purpose: Provide RLS policy templates for main tables (profiles, shipments, payments)
Commands (agent provides SQL policies, does NOT apply them):
- Provide sample RLS policies for each table in supabase/migrations/
Verify:
- Present policy SQL and test queries showing expected behavior with anonymized user ids
Estimated time: 120–240 minutes
Priority: High

----------------------------------------
PHASE 4 — BACKEND BUG FIXES & TESTS
----------------------------------------
T006 — Run backend integration tests against local Supabase dev
Purpose: Ensure services/controllers work with DB
Pre-req: T003, T004 must be defined and executed locally by user or agent (with staging DB)
Commands:
- Start supabase local dev: supabase start
- cd backend
- export SUPABASE_URL=... (local)
- export SUPABASE_ANON_KEY=...
- npm run test:integration
Expected output:
- Tests pass or provide failures and stack traces
Verify:
- Provide failing test names & stack traces
- Provide list of modified files to fix bugs
Rollback:
- Revert code changes per git history
Estimated time: 120–480 minutes (depending on issues)
Priority: High

T007 — Add health checks and DB connectivity endpoints
Purpose: Add /health and /health/db endpoints
Commands:
- Agent proposes edits (file patch) to backend/src/routes/health.ts or equivalent
- Run server: npm run dev
- curl http://localhost:3000/health
- curl http://localhost:3000/health/db
Verify:
- /health returns 200 and simple JSON {status:'ok'}
- /health/db returns DB status
Rollback:
- Revert commits
Estimated time: 30–90 minutes
Priority: Medium

----------------------------------------
PHASE 5 — CI / DOCKER / DEPLOY
----------------------------------------
T008 — Add GitHub Actions CI skeleton (lint/test/build)
Purpose: Create CI workflow file (no secrets needed)
Commands:
- Create .github/workflows/ci.yml with the provided skeleton
- git add, commit, show diff
Verify:
- On push to test branch, CI runs (user will trigger)
Rollback:
- Delete workflow file
Estimated time: 30–120 minutes
Priority: High

T009 — Add backend Dockerfile & multi-stage build
Purpose: Containerize backend for staging deployment
Commands:
- Create backend/Dockerfile (multi-stage)
- Build image locally: docker build -f backend/Dockerfile -t drivedrop-backend:staging .
- docker run -p 3000:3000 --env-file backend/.env drivedrop-backend:staging
Verify:
- Container starts and /health reachable
Rollback:
- Remove image
Estimated time: 60–180 minutes
Priority: Medium

----------------------------------------
PHASE 6 — MOBILE (Expo) & UI FIXES
----------------------------------------
T010 — Sync mobile env & ensure Expo starts
Purpose: Verify mobile dev server and load main flows
Commands:
- cd mobile
- cp .env.example .env (fill EXPO_PUBLIC_SUPABASE values locally)
- npm ci
- expo start --tunnel
Verify:
- Metro bundler starts with no blocking errors
- App loads in Expo Go or emulator
Rollback:
- Reinstall node_modules if corrupt
Estimated time: 30–90 minutes
Priority: High

T011 — UI Triage & list of visual bugs
Purpose: Create a reproducible list of UI bugs with screenshots, device details, and acceptance criteria.
Mode: Manual triage by agent — agent should open the app and capture screenshots of each problem.
Commands:
- Start app in simulator (iOS & Android recommended)
- Document each issue: file path(s) likely responsible, expected behavior, failing behavior, reproduction steps
- Save screenshots to /docs/ui-bugs/
Verify:
- For each bug provide: reproduction steps + screenshot + component file(s)
Rollback:
- No code changes yet
Estimated time: 60–240 minutes
Priority: High

T012 — Fix navigational and layout bugs (iterative)
Purpose: Fix specific UI bugs from T011 one-by-one
Process (per UI bug):
- Agent selects a single TID from T011 list to fix
- Agent shows exact files it will edit
- Agent runs changes locally and reloads simulator to capture screenshots
- Provide git diff and screenshots
- Wait for user approval
Commands (example):
- cd mobile
- git checkout -b feat/T012-fix-<shortdesc>
- edit files...
- npm run lint && npm run type-check
- expo start (or reload app)
Verify:
- Provide before/after screenshots and component diffs
Rollback:
- git reset --hard HEAD~1
Estimated time: 30–180 minutes per bug
Priority: Variable (per bug)

T013 — Accessibility & performance pass (mobile)
Purpose: Ensure accessibility labels, touch target sizes, and optimize heavy screens
Commands:
- Run axe or react-native-accessibility tools (if available)
- Test large lists for flatlist virtualization
Verification:
- Accessibility audit report
- Performance profiling report
Rollback:
- Revert changes if regressions appear
Estimated time: 120–480 minutes
Priority: Medium

----------------------------------------
PHASE 7 — STAGING DEPLOY & OBSERVABILITY
----------------------------------------
T014 — Setup staging environment & deploy
Purpose: Deploy backend docker image to chosen provider and point to staging Supabase
Commands:
- Build image and push to container registry (instructions depend on provider)
- Deploy using provider CLI/API
- Environment: point to staging SUPABASE values
Verify:
- health endpoints reachable
- run full smoke test suite
Rollback:
- Provider rollback to previous deployment
Estimated time: Variable (depends on provider)
Priority: High

T015 — Sentry integration & monitoring
Purpose: Integrate Sentry in backend and mobile for errors
Commands:
- Add SENTRY_DSN to env
- Integrate @sentry/node and @sentry/react-native
Verify:
- Simulate error and confirm Sentry receives event
Rollback:
- Remove DSN or revert change
Estimated time: 60–180 minutes
Priority: Medium

----------------------------------------
PHASE 8 — PRODUCTION RELEASE
----------------------------------------
T016 — Production checklist & launch
Purpose: Follow a pre-release checklist: secrets, backups, RLS, CI green, monitoring, EAS builds prepared
Commands:
- Validate all env vars, rotate keys, backups scheduled
- Run staging regression suite
Verify:
- All tests pass, monitoring reports OK
Rollback:
- Rollback deployment if critical issues occur
Estimated time: 180–480 minutes
Priority: High

----------------------------------------
AGENT TASK EXECUTION TEMPLATE (copy this before every change)
----------------------------------------
- Task ID:
- Mode (A or B):
- Files to change (relative paths):
- Commands I will run (exact):
- Expected outputs:
- Verification commands:
- Rollback commands:
- Commit message (if Mode A and making commits):
- I will now run the commands above (Y/N)?

----------------------------------------
NOTES:
- For every task that needs secrets, the agent must print a reminder and stop. The agent must never print the secrets to chat or commit them.
- For UI tasks that require screenshots, the agent must provide before/after images and exact device/emulator used.
- Always use feature branches and make small commits with the Task ID in the message.

----------------------------------------
TASK TRACKING (example)
- [ ] T001 Repo audit
- [ ] T002 lint fixes
- [ ] T003 UUID standardize
- [ ] T004 user types
- [ ] T005 RLS policies
- [ ] T006 backend integration tests
- [ ] T007 health endpoints
- [ ] T008 CI workflow
- [ ] T009 Dockerfile
- [ ] T010 Expo start
- [ ] T011 UI triage
- [ ] T012 UI fixes (iterative)
- [ ] T013 Accessibility & perf
- [ ] T014 staging deploy
- [ ] T015 Sentry
- [ ] T016 Production release

----------------------------------------
END CHECKLIST