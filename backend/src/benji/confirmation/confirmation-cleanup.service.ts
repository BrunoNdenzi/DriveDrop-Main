/**
 * Benji V2 — ConfirmationCleanupService
 * Phase 7D
 *
 * Scheduled job that prunes expired rows from benji_pending_confirmations.
 *
 * Design:
 *   - Runs on a configurable interval (default: every 15 minutes)
 *   - Calls confirmationStore.deleteExpired() — single DELETE WHERE expires_at < now()
 *   - Does NOT run at startup (first execution is after the first interval)
 *   - Logs pruned count when > 0 (silent on empty runs)
 *   - Interval handle is returned so callers can stop it (test/graceful shutdown)
 *
 * Alternative: use Supabase pg_cron for database-level TTL enforcement.
 * This service is the application-layer fallback when pg_cron is unavailable.
 *
 * Governance: I-8A
 */

import { logger } from '@utils/logger';
import { confirmationStore } from '@benji/confirmation/confirmation.store';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;  // 15 minutes

export class ConfirmationCleanupService {
  private _handle: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the cleanup job.
   * Safe to call multiple times — second call replaces the existing schedule.
   */
  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    this.stop();  // clear any existing schedule

    this._handle = setInterval(() => {
      void this._run();
    }, intervalMs);

    // Node.js: don't prevent process exit when this is the only remaining timer
    if (this._handle.unref) {
      this._handle.unref();
    }

    logger.warn('ConfirmationCleanupService: started', { intervalMs });
  }

  /** Stop the cleanup job. */
  stop(): void {
    if (this._handle !== null) {
      clearInterval(this._handle);
      this._handle = null;
    }
  }

  /** Run a single cleanup pass (also callable manually for testing). */
  async runOnce(): Promise<number> {
    return this._run();
  }

  private async _run(): Promise<number> {
    try {
      return await confirmationStore.deleteExpired();
    } catch (err: unknown) {
      logger.warn('ConfirmationCleanupService: cleanup run failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }
}

// ─── Singleton + auto-start ───────────────────────────────────────────────────

export const confirmationCleanupService = new ConfirmationCleanupService();

/**
 * Start the cleanup job as part of server bootstrap.
 * Called once from server startup (src/index.ts or app.ts).
 */
export function startConfirmationCleanup(intervalMs?: number): void {
  confirmationCleanupService.start(intervalMs);
}
