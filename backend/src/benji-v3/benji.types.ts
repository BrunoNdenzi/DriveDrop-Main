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
    date?:     string; // ISO date string e.g. "2026-08-15"
  };
  delivery?: {
    location?: string;
    date?:     string; // ISO date string
  };
  lastShipmentId?:   string;
  /** The shipment currently being discussed (tracking, messaging, status updates). */
  activeShipmentId?: string;
  lastQuote?: {
    total:             number;
    distanceMiles:     number;
    vehicleType:       string;
    /** e.g. 'expedited' | 'flexible' | 'standard' */
    deliveryType?:     string;
    /** Delivery type price multiplier e.g. 1.25 for expedited */
    deliveryMultiplier?: number;
  };
  /** Was a shipment creation confirmed by the user this session? */
  shipmentCreated?:  boolean;
  /** Has the user explicitly accepted DriveDrop T&C this session? */
  termsAccepted?:    boolean;
  /** Has a Stripe payment intent been initiated for the current shipment? */
  paymentInitiated?: boolean;
  /** Transport type preference captured from conversation */
  transportType?:    'open' | 'enclosed';
}

/** One entry in the session's conversation history (OpenAI wire format). */
export type V3Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Full server-side session stored in the V3SessionStore. */
export interface V3Session {
  readonly sessionId:    string;
  readonly userId:       string;
  readonly userType:     UserType;
  readonly channel:      'web' | 'mobile' | 'sms' | 'voice';
  /** E.164 phone number — set when channel = 'sms'. */
  readonly phoneNumber?: string;
  /** Conversation turns — includes assistant, user, tool, and tool-result messages. */
  messages:              V3Message[];
  /** Accumulated logistics context updated by the agent each turn. */
  context:               V3LogisticsContext;
  readonly createdAt:    number;
  lastActive:            number;
  expiresAt:             number;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type UserType = 'client' | 'driver' | 'admin' | 'broker';

export interface V3ChatRequest {
  message:   string;
  sessionId: string;
  userType:  UserType;
  userId:    string;
  /** Optional images for multimodal document processing */
  images?:   Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
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
