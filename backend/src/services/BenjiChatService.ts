import { createChatCompletion } from '@benji/ai/client/openai.client';
import { getBenjiChatPrompt } from '@benji/ai/prompt.registry';
import { SERVICE_MODEL_MAP, aiUsageTracker, aiResponseCache } from '../config/ai.config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatContext {
  userType: 'client' | 'driver' | 'admin' | 'broker';
  userId: string;
  currentPage?: string;
  shipmentId?: string;
  attachments?: Array<{ name: string; url: string; type: string; size: number }>;
}

export interface ChatResponse {
  message: string;
  confidence: number;
  suggestions?: string[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string;
  };
  cached?: boolean;
}

class BenjiChatService {
  async chat(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
    try {
      const modelConfig = SERVICE_MODEL_MAP['benji-chat'];
      const systemPrompt = getBenjiChatPrompt(context);

      // Check cache for the last user message
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
      const cached = aiResponseCache.get('benji-chat', lastUserMsg);
      if (cached) {
        return {
          message: cached.response,
          confidence: 0.90,
          suggestions: cached.suggestions || this.generateSuggestions(context, cached.response),
          cached: true,
        };
      }

      const startTime = Date.now();

      const completion = await createChatCompletion({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }, { serviceName: 'benji-chat', userId: context.userId });

      const durationMs = Date.now() - startTime;

      const message = completion.choices[0]?.message?.content || 
        "I'm having trouble responding right now. Please try again.";

      // Track token usage
      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;
      const estimatedCost = aiUsageTracker.calculateCost(promptTokens, completionTokens, modelConfig);

      aiUsageTracker.track({
        service: 'benji-chat',
        model: modelConfig.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        userId: context.userId,
        timestamp: new Date().toISOString(),
        durationMs,
      });

      // Calculate confidence based on completion metadata
      const confidence = this.calculateConfidence(completion);

      // Generate contextual suggestions
      const suggestions = this.generateSuggestions(context, message);

      // Cache the response for common queries
      aiResponseCache.set('benji-chat', lastUserMsg, message, suggestions);

      return {
        message,
        confidence,
        suggestions,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
          model: modelConfig.model,
        },
      };
    } catch (error: any) {
      console.error('Benji chat error:', error);

      // Handle OpenAI quota/rate limit errors
      if (error?.status === 429 || error?.code === 'insufficient_quota') {
        return this.getFallbackResponse(context, messages);
      }

      throw error;
    }
  }

  private calculateConfidence(completion: any): number {
    // Base confidence
    let confidence = 0.85;

    // Adjust based on finish_reason
    if (completion.choices[0]?.finish_reason === 'stop') {
      confidence = 0.95;
    } else if (completion.choices[0]?.finish_reason === 'length') {
      confidence = 0.80; // Truncated response
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private generateSuggestions(context: ChatContext, lastMessage: string): string[] {
    const lower = lastMessage.toLowerCase();

    // Context-aware suggestions based on conversation
    if (lower.includes('shipment') || lower.includes('create')) {
      return [
        "Get a quote",
        "Track my vehicles",
        "Upload documents",
      ];
    }

    if (lower.includes('track') || lower.includes('location')) {
      return [
        "Update delivery time",
        "Contact driver",
        "See route map",
      ];
    }

    if (lower.includes('quote') || lower.includes('price')) {
      return [
        "Create shipment now",
        "See pricing details",
        "Compare options",
      ];
    }

    // Default suggestions by user type
    switch (context.userType) {
      case 'driver':
        return ["Optimize my route", "Plan my day", "Find cheap fuel", "Show best loads"];
      case 'admin':
        return ["Auto-dispatch", "Support queue", "Performance"];
      case 'broker':
        return ["Upload vehicles", "Match carriers", "Revenue"];
      default:
        return ["Create shipment", "Track vehicle", "Get quote"];
    }
  }

  private getFallbackResponse(context: ChatContext, messages: ChatMessage[]): ChatResponse {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';

    // Simple keyword-based responses when OpenAI unavailable
    let message = "I'm experiencing some technical difficulties right now. Let me help you with the basics!";
    let suggestions: string[] = [];

    if (lastUserMessage.includes('track') || lastUserMessage.includes('where')) {
      message = "To track your vehicle, you can view real-time updates on your shipment page. Would you like me to guide you there?";
      suggestions.push("View shipment", "Contact support");
    } else if (lastUserMessage.includes('create') || lastUserMessage.includes('ship')) {
      message = "You can create a shipment using natural language! Just tell me what vehicle you want to ship and where it's going.";
      suggestions.push("Start creating", "Get a quote");
    } else if (lastUserMessage.includes('price') || lastUserMessage.includes('quote')) {
      message = "I can calculate a quote instantly! Just provide: vehicle details, pickup location, and delivery location.";
      suggestions.push("Calculate now", "See pricing");
    }

    // If no specific match, provide role-based suggestions
    if (suggestions.length === 0) {
      suggestions = this.generateSuggestions(context, message);
    }

    return {
      message,
      confidence: 0.70, // Lower confidence for fallback
      suggestions,
    };
  }
}

export const benjiChatService = new BenjiChatService();
