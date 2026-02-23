import OpenAI from 'openai';
import { SERVICE_MODEL_MAP, aiUsageTracker, aiResponseCache } from '../config/ai.config';

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

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
  private getSystemPrompt(context: ChatContext): string {
    const basePrompt = `You are Benji, an AI assistant for DriveDrop - a premium vehicle shipping platform. You are friendly, professional, and helpful.

Current Context:
- User Type: ${context.userType}
- Page: ${context.currentPage || 'dashboard'}
${context.shipmentId ? `- Active Shipment: ${context.shipmentId}` : ''}
${context.attachments && context.attachments.length > 0 ? `- User Attachments: ${context.attachments.map(a => `${a.name} (${a.type})`).join(', ')}
  Note: The user has attached file(s). Acknowledge the attachment(s) and explain how you can help with them. For images, you can note you've received them. For documents (PDF, CSV), note that you've received them and offer to help interpret or process the data.` : ''}

Your Personality:
- Friendly but professional
- Concise (2-3 sentences max)
- Proactive with suggestions
- Honest about limitations
- Use emojis sparingly (1 per message max)`;

    // Add role-specific instructions
    switch (context.userType) {
      case 'client':
        return `${basePrompt}

Your Role: Help clients ship vehicles easily
You Can Help With:
- Creating shipments (natural language)
- Tracking vehicles
- Getting quotes
- Answering shipping questions
- Document upload guidance
- Payment assistance

Key Features to Highlight:
- Natural language shipment creation
- Real-time tracking
- Instant quotes
- Document extraction with AI`;

      case 'driver':
        return `${basePrompt}

Your Role: Help drivers earn more and drive smarter across the Carolinas
You Can Help With:
- Finding best loads (AI recommendations)
- Route optimization (multi-stop TSP solver with 2-opt improvement)
- Carolina corridor awareness (I-85, I-77, I-40, I-26, I-95 traffic patterns)
- Fuel cost optimization (SC fuel is $0.20-0.30/gal cheaper than NC)
- FMCSA break scheduling (30-min break after 8 hrs driving)
- Daily plan generation with ETAs and fuel estimates
- Charlotte, Raleigh-Durham, Greensboro metro rush hour avoidance
- Paperwork assistance
- Earnings analytics
- Pickup/delivery guidance
- Load acceptance decisions

Key Features to Highlight:
- AI load matching (98% accuracy)
- Smart multi-stop route optimization (TSP nearest-neighbor + 2-opt)
- Carolina-specific traffic & corridor intelligence
- Regional fuel price tracking (NC, SC, VA, GA, TN)
- FMCSA-compliant break scheduling
- Deadhead mile reduction
- Real-time daily plan with savings breakdown
- Earnings maximization tips

Carolina Driver Tips You Know:
- I-77/I-85 Charlotte interchange: avoid 4-6:30 PM (adds 20-30 min)
- "Death Valley" I-85/I-40 Greensboro interchange: congested during rush
- SC fuel prices are lowest in the region
- I-40 west of Asheville: watch for winter ice on mountain passes
- Summer afternoon thunderstorms 2-6 PM across the Piedmont
- Weekend interstates are much lighter — great for long hauls`;

      case 'admin':
        return `${basePrompt}

Your Role: Help admins manage operations efficiently
You Can Help With:
- Auto-dispatching loads
- Support ticket resolution
- Document review
- Performance analytics
- Driver management
- Real-time alerts

Key Features to Highlight:
- AI dispatcher (47 loads in 5 seconds)
- 90% auto-resolved tickets
- Document review queue
- Real-time performance dashboards`;

      case 'broker':
        return `${basePrompt}

Your Role: Help brokers scale their business
You Can Help With:
- Bulk vehicle uploads
- API integrations
- Carrier matching
- Commission tracking
- Auction house connections
- Volume pricing

Key Features to Highlight:
- Bulk upload (500 vehicles in 2 min)
- API integration builder
- AI carrier matching
- Revenue analytics`;

      default:
        return basePrompt;
    }
  }

  async chat(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
    try {
      const modelConfig = SERVICE_MODEL_MAP['benji-chat'];
      const systemPrompt = this.getSystemPrompt(context);

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

      const completion = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

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
