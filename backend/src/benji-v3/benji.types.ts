/**
 * Benji V3 — Shared type definitions
 *
 * Architecture: LLM-controlled agent with tool delegation.
 * The LLM drives all conversation; tools are capabilities the LLM invokes
 * via OpenAI function-calling, NOT a rigid step pipeline.
 */

import type OpenAI from 'openai';

// ─── Workflow State Machine ───────────────────────────────────────────────────

/**
 * Every Benji conversation advances through a defined workflow state.
 * The current state is Benji's primary decision input alongside context and history.
 *
 * Transitions:
 *   DISCOVERING → COLLECTING_INFO (user expresses shipping intent)
 *   COLLECTING_INFO → QUOTING (all required fields gathered, quote generated)
 *   QUOTING → AWAITING_BOOKING_CONFIRMATION (booking summary presented)
 *   AWAITING_BOOKING_CONFIRMATION → CREATING_DRAFT (user explicitly confirms)
 *   CREATING_DRAFT → AWAITING_PAYMENT (draft shipment + payment link created)
 *   AWAITING_PAYMENT → BOOKED (Stripe webhook confirms payment)
 *   BOOKED → POST_BOOKING_SUPPORT (ongoing tracking / support)
 *
 * Backward transitions:
 *   Any state → COLLECTING_INFO (user requests changes)
 *   AWAITING_PAYMENT → COLLECTING_INFO (user explicitly cancels draft to restart)
 */
export type WorkflowState =
  | 'DISCOVERING'
  | 'COLLECTING_INFO'
  | 'QUOTING'
  | 'AWAITING_BOOKING_CONFIRMATION'
  | 'CREATING_DRAFT'
  | 'AWAITING_PAYMENT'
  | 'BOOKED'
  | 'POST_BOOKING_SUPPORT';

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Extracted logistics context accumulated across turns.
 * The LLM updates this by calling the `update_context` tool.
 */
export interface V3LogisticsContext {
  /** Current stage of the booking workflow — Benji's primary decision input. */
  workflowState?: WorkflowState;

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
  /** The draft shipment ID created by Benji, awaiting payment. */
  draftShipmentId?:  string;
  lastQuote?: {
    total:               number;
    distanceMiles:       number;
    vehicleType:         string;
    deliveryType?:       string;
    deliveryMultiplier?: number;
    transportType?:      string;
    pickupDate?:         string;
    deliveryDate?:       string;
  };
  /** Was a shipment creation confirmed by the user this session? */
  shipmentCreated?:  boolean;
  /** Has the user explicitly accepted DriveDrop T&C this session? */
  termsAccepted?:    boolean;
  /** Has a payment session been initiated for the current draft shipment? */
  paymentInitiated?: boolean;
  /** Active payment intent ID for idempotent payment creation. */
  activePaymentIntentId?: string;
  /** Transport type preference captured from conversation */
  transportType?:    'open' | 'enclosed';
  /** Is the vehicle operable? Defaults to true unless stated otherwise. */
  isOperable?:       boolean;
  /** True once logistics intent is detected — prevents tool dropout on short follow-up messages. */
  logisticsIntentActive?: boolean;
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
  /**
   * When a backend guard rejects a tool call due to missing context,
   * this lists exactly what information is still required.
   * Benji should use this to formulate its next clarification question.
   */
  missingFields?: string[];
}

