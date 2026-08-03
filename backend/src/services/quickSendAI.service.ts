import OpenAI from 'openai';
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

interface AIGenerationOptions {
  type: 'subject' | 'body' | 'both' | 'rewrite' | 'variations' | 'personalization';
  prompt?: string;
  subject?: string;
  body?: string;
  tone?: 'professional' | 'friendly' | 'urgent' | 'sales' | 'casual';
  category?: string;
  recipientData?: Record<string, any>;
  variations?: number;
}

interface AIGenerationResult {
  subject?: string;
  body?: string;
  variations?: Array<{ subject: string; body: string }>;
  tokensUsed: number;
}

class QuickSendAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate email content from natural language prompt
   */
  async generateFromPrompt(options: AIGenerationOptions, userId: string): Promise<AIGenerationResult> {
    const { prompt, tone = 'professional', category, type, variations: variationCount } = options;

    if (!prompt) {
      throw new Error('Prompt is required for content generation');
    }

    const systemPrompt = this.buildSystemPrompt(type, tone, category);
    const userPrompt = this.buildUserPrompt(type, prompt, variationCount);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: type === 'variations' ? 0.9 : 0.7,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      const result = this.parseAIResponse(content, type, variationCount);
      result.tokensUsed = tokensUsed;

      // Log AI generation
      await this.logGeneration({
        type,
        prompt,
        generatedContent: JSON.stringify(result),
        tokensUsed,
        userId,
      });

      return result;
    } catch (error) {
      logger.error('OpenAI API error', { error });
      throw new Error('Failed to generate content with AI');
    }
  }

  /**
   * Rewrite existing content with different tone
   */
  async rewriteContent(options: AIGenerationOptions, userId: string): Promise<AIGenerationResult> {
    const { subject, body, tone = 'professional' } = options;

    if (!subject && !body) {
      throw new Error('Subject or body required for rewriting');
    }

    const systemPrompt = `You are an expert email copywriter. Rewrite the provided email content in a ${tone} tone while preserving the core message and any personalization placeholders ({{...}}).`;

    const userPrompt = `Rewrite this email in a ${tone} tone:\n\nSubject: ${subject || 'N/A'}\n\nBody:\n${body || 'N/A'}\n\nProvide the response in this exact format:\nSUBJECT: [rewritten subject]\nBODY:\n[rewritten body]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      const result = this.parseAIResponse(content, 'both');
      result.tokensUsed = tokensUsed;

      await this.logGeneration({
        type: 'rewrite',
        prompt: `Rewrite (${tone}): ${subject}`,
        generatedContent: JSON.stringify(result),
        tokensUsed,
        userId,
      });

      return result;
    } catch (error) {
      logger.error('OpenAI rewrite error', { error });
      throw new Error('Failed to rewrite content');
    }
  }

  /**
   * Suggest personalization fields based on content
   */
  async suggestPersonalization(content: string, userId: string): Promise<string[]> {
    const systemPrompt = 'You are an email personalization expert. Analyze email content and suggest relevant personalization fields.';
    const userPrompt = `Analyze this email and suggest personalization fields that would make it more effective:\n\n${content}\n\nProvide only a JSON array of field names, e.g., ["firstName", "company", "location", "industryType"]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      const content = completion.choices[0]?.message?.content || '[]';
      const tokensUsed = completion.usage?.total_tokens || 0;

      const fields = JSON.parse(content.trim()) as string[];

      await this.logGeneration({
        type: 'personalization',
        prompt: 'Suggest personalization fields',
        generatedContent: JSON.stringify(fields),
        tokensUsed,
        userId,
      });

      return fields;
    } catch (error) {
      logger.error('OpenAI personalization suggestion error', { error });
      return ['firstName', 'company']; // Fallback defaults
    }
  }

  /**
   * Generate personalized content for specific recipient
   */
  async personalizeForRecipient(
    template: string,
    recipientData: Record<string, any>,
    userId: string
  ): Promise<string> {
    const systemPrompt = 'You are an expert at personalizing email content. Enhance the template with recipient-specific details while maintaining the core message.';
    const userPrompt = `Personalize this email template for the recipient:\n\nTemplate:\n${template}\n\nRecipient Data:\n${JSON.stringify(recipientData, null, 2)}\n\nReplace {{placeholders}} with actual values and enhance the content to be more personal and relevant to this specific recipient.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const personalizedContent = completion.choices[0]?.message?.content || template;
      const tokensUsed = completion.usage?.total_tokens || 0;

      await this.logGeneration({
        type: 'personalization',
        prompt: 'Personalize for recipient',
        generatedContent: personalizedContent,
        tokensUsed,
        userId,
      });

      return personalizedContent;
    } catch (error) {
      logger.error('OpenAI personalization error', { error });
      return template; // Fallback to original template
    }
  }

  private buildSystemPrompt(type: string, tone: string, category?: string): string {
    const basePrompt = `You are an expert email marketing copywriter specializing in ${category || 'business'} communications.`;
    
    const toneDescriptions = {
      professional: 'formal, respectful, and business-appropriate',
      friendly: 'warm, approachable, and conversational',
      urgent: 'time-sensitive, action-oriented, and compelling',
      sales: 'persuasive, benefit-focused, and conversion-driven',
      casual: 'relaxed, personal, and informal'
    };

    const toneDesc = toneDescriptions[tone as keyof typeof toneDescriptions] || toneDescriptions.professional;

    let taskDesc = '';
    switch (type) {
      case 'subject':
        taskDesc = 'Generate compelling email subject lines that drive opens.';
        break;
      case 'body':
        taskDesc = 'Write engaging email body content that drives action.';
        break;
      case 'both':
        taskDesc = 'Create complete email campaigns with subject lines and body content.';
        break;
      case 'variations':
        taskDesc = 'Generate multiple variations of email campaigns for A/B testing.';
        break;
      default:
        taskDesc = 'Create effective email content.';
    }

    return `${basePrompt} Your tone should be ${toneDesc}. ${taskDesc}

IMPORTANT: Use {{placeholders}} for personalization fields like {{firstName}}, {{company}}, {{customField:fieldName}}.
Keep subject lines under 60 characters.
Make body content scannable with short paragraphs.
Always include a clear call-to-action.`;
  }

  private buildUserPrompt(type: string, prompt: string, variations?: number): string {
    let instruction = '';
    
    if (type === 'variations' && variations) {
      instruction = `Generate ${variations} different versions of an email campaign based on this request:\n\n${prompt}\n\nProvide response in this format:\n\nVERSION 1:\nSUBJECT: [subject]\nBODY:\n[body]\n\nVERSION 2:\nSUBJECT: [subject]\nBODY:\n[body]\n\n...`;
    } else if (type === 'subject') {
      instruction = `Generate an email subject line for:\n\n${prompt}\n\nProvide only the subject line, nothing else.`;
    } else if (type === 'body') {
      instruction = `Generate email body content for:\n\n${prompt}\n\nProvide only the email body, nothing else.`;
    } else {
      instruction = `Generate a complete email campaign for:\n\n${prompt}\n\nProvide the response in this exact format:\nSUBJECT: [subject line]\nBODY:\n[email body content]`;
    }

    return instruction;
  }

  private parseAIResponse(content: string, type: string, variations?: number): AIGenerationResult {
    const result: AIGenerationResult = { tokensUsed: 0 };

    if (type === 'variations' && variations) {
      // Parse multiple variations
      const variationRegex = /VERSION \d+:\s*SUBJECT:\s*(.+?)\s*BODY:\s*([\s\S]+?)(?=VERSION \d+:|$)/g;
      const matches = [...content.matchAll(variationRegex)];
      
      result.variations = matches.map(match => ({
        subject: match[1]?.trim() || '',
        body: match[2]?.trim() || ''
      }));

      // Fallback if parsing fails
      if (result.variations.length === 0) {
        result.variations = [{ subject: 'Generated Subject', body: content }];
      }
    } else if (type === 'subject') {
      // Just extract the subject
      result.subject = content.trim();
    } else if (type === 'body') {
      // Just extract the body
      result.body = content.trim();
    } else {
      // Parse subject and body
      const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|$)/);
      const bodyMatch = content.match(/BODY:\s*([\s\S]+)$/);

      result.subject = subjectMatch?.[1]?.trim() || '';
      result.body = bodyMatch?.[1]?.trim() || content;
    }

    return result;
  }

  private async logGeneration(data: {
    type: string;
    prompt: string;
    generatedContent: string;
    tokensUsed: number;
    userId: string;
  }): Promise<void> {
    try {
      await supabaseAdmin.from('quick_send_ai_generations').insert({
        generation_type: data.type,
        input_prompt: data.prompt,
        generated_content: data.generatedContent,
        tokens_used: data.tokensUsed,
        generated_by: data.userId,
      });
    } catch (error) {
      logger.error('Failed to log AI generation', { error });
      // Non-blocking error
    }
  }
}

export const quickSendAIService = new QuickSendAIService();
