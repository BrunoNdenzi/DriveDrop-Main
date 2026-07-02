/**
 * Benji V2 — tool:shipment.parse
 * Phase 3
 *
 * Wraps NaturalLanguageShipmentService.parseShipment().
 * Registry handles ToolResult wrapping, timing, and error isolation.
 */

import NaturalLanguageShipmentService from '../../services/NaturalLanguageShipmentService';
import type { NLShipmentInput, NLParseResult } from '../../services/NaturalLanguageShipmentService';
import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';

// One instance — NaturalLanguageShipmentService has no stateful deps
const _nlService = new NaturalLanguageShipmentService();

export type ShipmentParseInput  = NLShipmentInput;
export type ShipmentParseOutput = NLParseResult;

function isShipmentParseInput(input: unknown): input is ShipmentParseInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['user_id']      === 'string' &&
         typeof obj['input_text']   === 'string' &&
         typeof obj['input_method'] === 'string';
}

export const shipmentParseTool: ToolDefinition<ShipmentParseInput, ShipmentParseOutput> = {
  name:        'tool:shipment.parse',
  description: 'Parse natural language text into structured shipment data using GPT-4o.',
  isMutation:  false,   // parse is read-only; subsequent tool:shipment.create is the mutation
  validate:    isShipmentParseInput,

  execute: async (input: ShipmentParseInput, _context: ToolContext): Promise<ShipmentParseOutput> => {
    return _nlService.parseShipment(input);
  },
};
