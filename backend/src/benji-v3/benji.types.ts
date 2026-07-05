/**
 * Benji V3 — Shared type definitions
 *
 * Architecture: LLM-controlled agent with tool delegation.
 * The LLM drives all conversation; tools are capabilities the LLM invokes
 * via OpenAI function-calling, NOT a rigid step pipeline.
 */

import type OpenAI from 'openai';

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Extracted logistics context accumulated across turns.
 * The LLM updates this by calling the special `update_context` tool.
 */
export interface V3LogisticsContext {
  vehicle?: {
    year?:  number;
    make?:  string;
    model?: string;
    vin?:   string;
    type?:  string;
  };
  pickup?: {
    location?: string;
  };
  delivery?: {
    location?: string;
  };
  lastShipmentId?:   string;
  /** The shipment currently being discussed (tracking, messaging, status updates). */
  activeShipmentId?: string;
  lastQuote?: {
    total:        number;
    distanceMiles: number;
    vehicleType:  string;
  };
  /** Was a shipment creation confirmed by the user this session? */
  shipmentCreated?: boolean;
}

/** One entry in the session's conversation history (OpenAI wire format). */
export type V3Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Full server-side session stored in the V3SessionStore. */
export interface V3Session {
  readonly sessionId:   string;
  readonly userId:      string;
  readonly userType:    UserType;
  /** Conversation turns — includes assistant, user, tool, and tool-result messages. */
  messages:             V3Message[];
  /** Accumulated logistics context updated by the agent each turn. */
  context:              V3LogisticsContext;
  readonly createdAt:   number;
  lastActive:           number;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type UserType = 'client' | 'driver' | 'admin' | 'broker';

export interface V3ChatRequest {
  message:   string;
  sessionId: string;
  userType:  UserType;
  userId:    string;
}

export interface V3ChatResponse {
  response:    string;
  sessionId:   string;
  toolsUsed:   string[];
  /** Total wall-clock time for this request (ms). */
  latencyMs:   number;
}

// ─── Tool I/O ─────────────────────────────────────────────────────────────────

export interface V3ToolResult {
  success:  boolean;
  data:     unknown;
  /** One-sentence human-readable summary the LLM may quote verbatim in its reply. */
  summary:  string;
  /** On failure: friendly error the LLM can relay conversationally. */
  errorMessage?: string;
}
