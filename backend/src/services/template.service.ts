import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

export interface TemplateField {
  fieldName: string;
  label: string;
  required: boolean;
  fallback?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  message: string;
  description?: string;
  fieldMappings: TemplateField[];
  isSystem: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  useCount: number;
}

export interface CreateTemplateInput {
  name: string;
  category: string;
  subject: string;
  message: string;
  description?: string;
  fieldMappings?: TemplateField[];
}

export interface UpdateTemplateInput {
  name?: string;
  category?: string;
  subject?: string;
  message?: string;
  description?: string;
  fieldMappings?: TemplateField[];
}

class TemplateService {
  /**
   * Get all templates (system + user-created)
   */
  async listTemplates(userId?: string, category?: string) {
    let query = supabaseAdmin
      .from('quick_send_templates')
      .select('*')
      .order('use_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to list templates', { error });
      throw new Error('Failed to retrieve templates');
    }

    return data as Template[];
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string) {
    const { data, error } = await supabaseAdmin
      .from('quick_send_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to get template', { id, error });
      throw new Error('Template not found');
    }

    return data as Template;
  }

  /**
   * Create new template
   */
  async createTemplate(input: CreateTemplateInput, userId: string) {
    const { data, error } = await supabaseAdmin
      .from('quick_send_templates')
      .insert({
        name: input.name,
        category: input.category,
        subject: input.subject,
        message: input.message,
        description: input.description,
        field_mappings: input.fieldMappings || [],
        is_system: false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create template', { input, error });
      throw new Error('Failed to create template');
    }

    return data as Template;
  }

  /**
   * Update existing template
   */
  async updateTemplate(id: string, input: UpdateTemplateInput, userId: string) {
    // Check if template is system template
    const existing = await this.getTemplate(id);
    if (existing.isSystem) {
      throw new Error('Cannot modify system templates');
    }

    // Check ownership
    if (existing.createdBy !== userId) {
      throw new Error('You can only edit your own templates');
    }

    const { data, error } = await supabaseAdmin
      .from('quick_send_templates')
      .update({
        ...(input.name && { name: input.name }),
        ...(input.category && { category: input.category }),
        ...(input.subject && { subject: input.subject }),
        ...(input.message && { message: input.message }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.fieldMappings && { field_mappings: input.fieldMappings }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update template', { id, input, error });
      throw new Error('Failed to update template');
    }

    return data as Template;
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string, userId: string) {
    const existing = await this.getTemplate(id);
    
    if (existing.isSystem) {
      throw new Error('Cannot delete system templates');
    }

    if (existing.createdBy !== userId) {
      throw new Error('You can only delete your own templates');
    }

    const { error } = await supabaseAdmin
      .from('quick_send_templates')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete template', { id, error });
      throw new Error('Failed to delete template');
    }

    return { success: true };
  }

  /**
   * Clone template (create copy)
   */
  async cloneTemplate(id: string, userId: string) {
    const original = await this.getTemplate(id);

    const { data, error } = await supabaseAdmin
      .from('quick_send_templates')
      .insert({
        name: `${original.name} (Copy)`,
        category: original.category,
        subject: original.subject,
        message: original.message,
        description: original.description,
        field_mappings: original.fieldMappings,
        is_system: false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to clone template', { id, error });
      throw new Error('Failed to clone template');
    }

    return data as Template;
  }

  /**
   * Increment template use count
   */
  async incrementUseCount(id: string) {
    await supabaseAdmin
      .from('quick_send_templates')
      .update({ use_count: supabaseAdmin.rpc('increment', { x: 1 }) as any })
      .eq('id', id);
  }

  /**
   * Apply template with personalization
   */
  applyTemplate(template: Template, recipientData: Record<string, any>): { subject: string; message: string } {
    let subject = template.subject;
    let message = template.message;

    // Replace standard placeholders
    const replacements: Record<string, string> = {
      firstName: recipientData.firstName || recipientData.name?.split(' ')[0] || 'there',
      lastName: recipientData.lastName || recipientData.name?.split(' ').slice(1).join(' ') || '',
      name: recipientData.name || 'there',
      email: recipientData.email || '',
      company: recipientData.company || 'your company',
      ...recipientData.customFields, // Merge custom fields
    };

    // Replace {{fieldName}} and {{customField:fieldName}}
    const placeholderRegex = /\{\{(customField:)?([a-zA-Z0-9_]+)\}\}/g;

    subject = subject.replace(placeholderRegex, (match, isCustom, fieldName) => {
      // Check template field mappings for fallback
      const fieldMapping = template.fieldMappings.find(f => f.fieldName === fieldName);
      const fallback = fieldMapping?.fallback || match;

      return replacements[fieldName] || recipientData[fieldName] || fallback;
    });

    message = message.replace(placeholderRegex, (match, isCustom, fieldName) => {
      const fieldMapping = template.fieldMappings.find(f => f.fieldName === fieldName);
      const fallback = fieldMapping?.fallback || match;

      return replacements[fieldName] || recipientData[fieldName] || fallback;
    });

    return { subject, message };
  }

  /**
   * Extract placeholders from template content
   */
  extractPlaceholders(content: string): string[] {
    const placeholderRegex = /\{\{(customField:)?([a-zA-Z0-9_]+)\}\}/g;
    const matches = [...content.matchAll(placeholderRegex)];
    const uniquePlaceholders = new Set(matches.map(m => m[2] || ''));
    return Array.from(uniquePlaceholders);
  }

  /**
   * Validate template content
   */
  validateTemplate(template: CreateTemplateInput | UpdateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (template.subject && template.subject.length > 200) {
      errors.push('Subject line too long (max 200 characters)');
    }

    if (template.message && template.message.length < 10) {
      errors.push('Message too short (min 10 characters)');
    }

    if (template.name && template.name.length < 3) {
      errors.push('Template name too short (min 3 characters)');
    }

    // Check for unmatched placeholders
    const allContent = `${template.subject || ''} ${template.message || ''}`;
    const openBraces = (allContent.match(/\{\{/g) || []).length;
    const closeBraces = (allContent.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Unmatched placeholder braces - ensure all {{placeholders}} are properly closed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get template categories
   */
  async getCategories() {
    const { data, error } = await supabaseAdmin
      .from('quick_send_templates')
      .select('category')
      .order('category');

    if (error) {
      logger.error('Failed to get categories', { error });
      return ['logistics', 'broker_outreach', 'driver_recruitment', 'custom'];
    }

    const categories = [...new Set(data.map(d => d.category))];
    return categories.length > 0 ? categories : ['logistics', 'broker_outreach', 'driver_recruitment', 'custom'];
  }
}

export const templateService = new TemplateService();
