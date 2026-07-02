/**
 * Benji V2 — tool:chat.respond
 * Phase 3
 *
 * Wraps BenjiChatService.chat().
 * Registry handles ToolResult wrapping, timing, and error isolation.
 */

import { benjiChatService } from '../../services/BenjiChatService';
import type { ChatMessage, ChatContext, ChatResponse } from '../../services/BenjiChatService';
import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';

export interface ChatRespondInput {
  messages: ChatMessage[];
  context:  ChatContext;
}

export type ChatRespondOutput = ChatResponse;

function isChatRespondInput(input: unknown): input is ChatRespondInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return Array.isArray(obj['messages']) &&
         typeof obj['context'] === 'object' && obj['context'] !== null;
}

export const chatRespondTool: ToolDefinition<ChatRespondInput, ChatRespondOutput> = {
  name:        'tool:chat.respond',
  description: 'Generate a Benji AI chat response using GPT-4o-mini with context-aware prompting.',
  isMutation:  false,   // read-only; chat history persistence is handled separately (Phase 5)
  validate:    isChatRespondInput,

  execute: async (input: ChatRespondInput, _context: ToolContext): Promise<ChatRespondOutput> => {
    return benjiChatService.chat(input.messages, input.context);
  },
};
