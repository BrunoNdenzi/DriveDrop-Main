# DriveDrop — Updated Plan (Interactive flow)

Goal
- Make DriveDrop backend, mobile, and Supabase schema production-ready while fixing UI issues.
- Work interactively: the agent executes one well-defined task at a time and pauses for explicit human confirmation before proceeding.

High-level phases
1. Preparation & local dev environment
2. Repo automated audit (lint/type-check/vuln scan)
3. Database consolidation & migrations (Supabase)
4. Backend runtime fixes & API testing
5. CI/CD & containerization
6. Mobile compile/build & UI fixes
7. Staging deploy, monitoring, and hardening
8. Production deployment & release

New addition: UI work
- Fix navigation bugs, layout breakages, form validation and UX flows.
- Accessibility: contrast, screen-reader labels, touch target sizes.
- Performance: asset sizes, lazy-loading lists, memory leaks.
- Platform parity: Android vs iOS visual issues, Expo web if needed.

Interactive workflow (strict rules the agent must follow)
- The user drives the plan. The agent only runs the exact commands listed for a given Task ID.
- Before running anything, the agent must list the exact command(s) it will run and the files it will modify.
- The agent runs the commands and captures full stdout/stderr and exit codes.
- The agent shows:
  - a list of files changed (git status),
  - the git diff (or patch),
  - test outputs,
  - any screenshots (for UI tasks) — instruct how to capture them if needed.
- The agent must not push or merge any branch nor open any PR without explicit permission from the user.
- After presenting results the agent pauses. The user must confirm "OK to apply/push" or "Reject / iterate".
- If the user approves, the agent follows the approved next step (e.g., push branch, deploy to staging). If rejected, the agent rewinds (git restore / checkout) and repeats the requested iteration.
- All commands must be deterministic (no random seeds, timestamps in outputs kept) and reproducible.

Agent reporting format (strict)
1. Task ID
2. Commands run (exact)
3. Files changed (list)
4. Git diff (unified)
5. Test & lint output (full)
6. Verification checks and results (pass/fail)
7. Next suggested action (two options)
8. Wait for user instruction: "Approve", "Iterate", or "Abort".

Change management & rollback policy
- Use a feature branch naming pattern: feat/<task-id>-<short-desc> (e.g., feat/T003-fix-types).
- Agent creates commits with the following message format:
  - [T###] short description — detailed one-line
  - Body: list of files changed & rationale
- Rollback commands (when applicable):
  - Undo local changes: git restore --staged . && git restore .
  - Delete branch locally: git branch -D <branch>
  - Delete remote branch (only if pushed and approved): git push origin --delete <branch>

How to pick the next task
- Start with Task T001: Repo audit & smoke run (recommended).
- Provide environment values intermittently as requested by the agent when a task requires secrets.
- After each task completion, request the next Task ID.

Acceptance criteria for "production ready"
- Backend: all endpoints pass integration tests + lint/type-check with zero critical errors; healthy DB migrations; CI passes.
- Mobile: builds for production succeed (EAS) with no console errors in debug; main UX flows validated; basic analytics & Sentry integrated.
- Supabase: migrations applied and verified; RLS policies are in place for main resources and tested; backups configured.
- Observability: Sentry + logs available; minimal alert rules configured.

Security & secrets
- Never store secrets in repository. Use GitHub Secrets and local .env files ignored by git.
- The checklist will call out where SUPABASE_SERVICE_ROLE_KEY, STRIPE keys, GOOGLE_MAPS_API_KEY, and Expo/EAS credentials are required.

Staging & deployment recommendations
- Use a staging Supabase project and a staging hosting environment (Render/Fly/Cloud Run).
- Use GitHub Actions for CI, and for deployment optionally use the provider's native GitHub integration (Render/Fly) or build/push container to registry and deploy with their API.

What I’m waiting on from you now
- Choose the first task from the Checklist (recommended: T001).
- Confirm agent mode:
  - Mode A: Agent applies changes locally, commits to feature branch, shows diff, waits for approve to push/deploy.
  - Mode B: Agent only generates patches or suggested edits (no commits).
- If Mode A, confirm branch push rules (we will not open PRs unless you ask).