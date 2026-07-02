-- Migration: 20260702120400_benji_memories.sql
-- Phase: 4 (SupabaseMemoryStore)
-- Depends on: (none — standalone table)
-- Safe Re-run: Yes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)

-- ─────────────────────────────────────────────────────────────────────────────
-- benji_memories
-- Persistent key-value store for per-user Benji memory (Phase 4).
-- Consumed by: supabase-memory.store.ts (SupabaseMemoryStore)
-- Upsert on (user_id, namespace, key) → last-write-wins.
-- Optional TTL: ttl_seconds drives expiry in application-layer cleanup.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benji_memories (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL,
  namespace    TEXT        NOT NULL,
  key          TEXT        NOT NULL,
  value        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ttl_seconds  INTEGER,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT benji_memories_user_namespace_key UNIQUE (user_id, namespace, key)
);

-- Index for per-user memory fetches (SupabaseMemoryStore.get queries by user_id)
CREATE INDEX IF NOT EXISTS benji_memories_user_id_idx
  ON public.benji_memories (user_id);

-- Index for TTL-based cleanup (future cleanup service)
CREATE INDEX IF NOT EXISTS benji_memories_updated_at_idx
  ON public.benji_memories (updated_at);

ALTER TABLE public.benji_memories ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only (I-8A)
-- supabaseAdmin (service role) bypasses RLS automatically

COMMENT ON TABLE public.benji_memories IS
  'Benji V2 Phase 4 — per-user persistent memory store. '
  'Written by supabase-memory.store.ts. '
  'Reads use user_id to scope results; namespace+key for lookups.';
