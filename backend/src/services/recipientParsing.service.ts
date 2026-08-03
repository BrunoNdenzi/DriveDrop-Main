import { parse as parseCSV } from 'csv-parse/sync';
import { logger } from '@utils/logger';

export interface ParsedRecipient {
  email: string;
  name?: string;
  customFields: Record<string, string>;
  isValid: boolean;
  validationError?: string;
}

export interface ParseResult {
  recipients: ParsedRecipient[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  fieldNames: string[]; // Detected custom fields
}

export interface CSVMapping {
  emailColumn: string;
  nameColumn?: string;
  customFieldMappings: Record<string, string>; // fieldName -> columnName
}

class RecipientParsingService {
  private emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

  /**
   * Parse text input (handles various formats)
   * Formats supported:
   * - name@example.com
   * - Name <name@example.com>
   * - "First Last" <name@example.com>
   * - name@example.com, First Last
   * - Mixed text with emails embedded
   */
  parseTextInput(text: string): ParseResult {
    const lines = text.split(/[\n,;]/);
    const seenEmails = new Set<string>();
    const recipients: ParsedRecipient[] = [];
    let duplicateCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parsed = this.parseSingleLine(trimmed);
      if (parsed) {
        const normalizedEmail = parsed.email.toLowerCase();
        
        if (seenEmails.has(normalizedEmail)) {
          duplicateCount++;
          continue;
        }

        seenEmails.add(normalizedEmail);
        recipients.push(parsed);
      }
    }

    const validCount = recipients.filter(r => r.isValid).length;
    const invalidCount = recipients.filter(r => !r.isValid).length;

    return {
      recipients,
      validCount,
      invalidCount,
      duplicateCount,
      fieldNames: ['name'], // Text parsing only extracts name
    };
  }

  /**
   * Extract all emails from mixed content
   */
  extractEmailsFromContent(content: string): ParseResult {
    const emailMatches = content.match(this.emailRegex) || [];
    const seenEmails = new Set<string>();
    const recipients: ParsedRecipient[] = [];
    let duplicateCount = 0;

    for (const email of emailMatches) {
      const normalizedEmail = email.toLowerCase().trim();
      
      if (seenEmails.has(normalizedEmail)) {
        duplicateCount++;
        continue;
      }

      seenEmails.add(normalizedEmail);
      const validation = this.validateEmail(normalizedEmail);
      
      recipients.push({
        email: normalizedEmail,
        customFields: {},
        isValid: validation.isValid,
        validationError: validation.error,
      });
    }

    const validCount = recipients.filter(r => r.isValid).length;
    const invalidCount = recipients.filter(r => !r.isValid).length;

    return {
      recipients,
      validCount,
      invalidCount,
      duplicateCount,
      fieldNames: [],
    };
  }

  /**
   * Parse CSV file content
   */
  parseCSV(fileContent: string, mapping?: CSVMapping): ParseResult {
    try {
      const records = parseCSV(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true, // Handle UTF-8 BOM
      }) as Record<string, string>[];

      // Auto-detect email column if not provided
      const detectedMapping = mapping || this.autoDetectCSVMapping(records);
      const seenEmails = new Set<string>();
      const recipients: ParsedRecipient[] = [];
      let duplicateCount = 0;

      for (const record of records) {
        const email = record[detectedMapping.emailColumn]?.trim().toLowerCase();
        if (!email) continue;

        if (seenEmails.has(email)) {
          duplicateCount++;
          continue;
        }

        seenEmails.add(email);
        const validation = this.validateEmail(email);

        // Extract custom fields
        const customFields: Record<string, string> = {};
        for (const [fieldName, columnName] of Object.entries(detectedMapping.customFieldMappings)) {
          const value = record[columnName]?.trim();
          if (value) {
            customFields[fieldName] = value;
          }
        }

        // Extract name
        let name: string | undefined;
        if (detectedMapping.nameColumn) {
          name = record[detectedMapping.nameColumn]?.trim();
        }

        recipients.push({
          email,
          name,
          customFields,
          isValid: validation.isValid,
          validationError: validation.error,
        });
      }

      const validCount = recipients.filter(r => r.isValid).length;
      const invalidCount = recipients.filter(r => !r.isValid).length;
      const fieldNames = ['name', ...Object.keys(detectedMapping.customFieldMappings)];

      return {
        recipients,
        validCount,
        invalidCount,
        duplicateCount,
        fieldNames,
      };
    } catch (error) {
      logger.error('CSV parsing error', { error });
      throw new Error('Failed to parse CSV file. Please ensure it is properly formatted.');
    }
  }

  /**
   * Auto-detect CSV column mappings
   */
  autoDetectCSVMapping(records: Record<string, string>[]): CSVMapping {
    if (records.length === 0) {
      throw new Error('CSV file is empty');
    }

    const firstRecord = records[0]!;
    const columns = Object.keys(firstRecord);

    // Detect email column
    const emailColumn = this.findColumn(columns, [
      'email',
      'e-mail',
      'email address',
      'mail',
      'contact',
      'recipient',
    ]);

    if (!emailColumn) {
      throw new Error('Could not detect email column. Please ensure your CSV has an "Email" column.');
    }

    // Detect name column
    const nameColumn = this.findColumn(columns, [
      'name',
      'full name',
      'fullname',
      'contact name',
      'recipient name',
      'first name',
      'firstname',
    ]);

    // Map remaining columns as custom fields
    const customFieldMappings: Record<string, string> = {};
    for (const col of columns) {
      if (col !== emailColumn && col !== nameColumn) {
        // Convert column name to camelCase field name
        const fieldName = col
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^./, (char) => char.toLowerCase());
        
        customFieldMappings[fieldName] = col;
      }
    }

    return {
      emailColumn,
      nameColumn,
      customFieldMappings,
    };
  }

  /**
   * Get CSV column information for preview
   */
  getCSVColumns(fileContent: string): string[] {
    try {
      const records = parseCSV(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        to_line: 1, // Only parse first row
      }) as Record<string, string>[];

      return records.length > 0 ? Object.keys(records[0]!) : [];
    } catch (error) {
      logger.error('Failed to extract CSV columns', { error });
      return [];
    }
  }

  /**
   * Parse a single line of text
   */
  private parseSingleLine(line: string): ParsedRecipient | null {
    // Format: "Name" <email@example.com>
    const namedEmailMatch = line.match(/^["']?([^"'<>]+?)["']?\s*<([^>]+)>$/);
    if (namedEmailMatch) {
      const name = namedEmailMatch[1]?.trim();
      const email = namedEmailMatch[2]?.trim().toLowerCase() || '';
      const validation = this.validateEmail(email);
      
      return {
        email,
        name,
        customFields: {},
        isValid: validation.isValid,
        validationError: validation.error,
      };
    }

    // Format: email@example.com, Name
    const emailNameMatch = line.match(/^([^,]+),\s*(.+)$/);
    if (emailNameMatch) {
      const email = emailNameMatch[1]?.trim().toLowerCase() || '';
      const name = emailNameMatch[2]?.trim();
      const validation = this.validateEmail(email);
      
      return {
        email,
        name,
        customFields: {},
        isValid: validation.isValid,
        validationError: validation.error,
      };
    }

    // Format: plain email
    const email = line.trim().toLowerCase();
    if (this.emailRegex.test(email)) {
      const validation = this.validateEmail(email);
      
      return {
        email,
        customFields: {},
        isValid: validation.isValid,
        validationError: validation.error,
      };
    }

    // Try to extract email from text
    const extracted = line.match(this.emailRegex);
    if (extracted && extracted[0]) {
      const email = extracted[0].toLowerCase();
      const validation = this.validateEmail(email);
      
      return {
        email,
        customFields: {},
        isValid: validation.isValid,
        validationError: validation.error,
      };
    }

    return null;
  }

  /**
   * Validate email address
   */
  private validateEmail(email: string): { isValid: boolean; error?: string } {
    // Basic format check
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    // Check for common typos
    const commonTypos = ['gmial.com', 'gmai.com', 'yahooo.com', 'hotmial.com'];
    const domain = email.split('@')[1];
    if (domain && commonTypos.some(typo => domain.includes(typo))) {
      return { isValid: false, error: 'Possible typo in domain' };
    }

    // Check length
    if (email.length > 254) {
      return { isValid: false, error: 'Email too long' };
    }

    const [localPart, domainPart] = email.split('@');
    if (localPart && localPart.length > 64) {
      return { isValid: false, error: 'Local part too long' };
    }

    // Check for disposable email domains (basic list)
    const disposableDomains = [
      'tempmail.com',
      'throwaway.email',
      '10minutemail.com',
      'guerrillamail.com',
    ];
    if (domainPart && disposableDomains.some(d => domainPart.includes(d))) {
      return { isValid: false, error: 'Disposable email detected' };
    }

    return { isValid: true };
  }

  /**
   * Find column by various possible names
   */
  private findColumn(columns: string[], possibleNames: string[]): string | undefined {
    const normalizedColumns = columns.map(c => c.toLowerCase().trim());
    
    for (const name of possibleNames) {
      const index = normalizedColumns.indexOf(name.toLowerCase());
      if (index !== -1) {
        return columns[index];
      }
    }

    // Partial match fallback
    for (const name of possibleNames) {
      const index = normalizedColumns.findIndex(c => c.includes(name.toLowerCase()));
      if (index !== -1) {
        return columns[index];
      }
    }

    return undefined;
  }

  /**
   * Remove duplicates from recipient list
   */
  deduplicateRecipients(recipients: ParsedRecipient[]): ParsedRecipient[] {
    const seen = new Set<string>();
    return recipients.filter(r => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });
  }
}

export const recipientParsingService = new RecipientParsingService();
