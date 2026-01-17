/**
 * Natural Language Shipment Service
 * 
 * Allows creating shipments via natural language input using GPT-4.
 * Users can describe shipments in plain English, and AI extracts structured data.
 * 
 * Supported Input Methods:
 * - Text prompts
 * - Voice transcription (via Speech-to-Text)
 * - Email parsing
 * - WhatsApp/SMS messages
 * 
 * Example inputs:
 * "Ship a 2018 Tesla Model 3 from Los Angeles to New York next week"
 * "Need to transport my blue Honda Accord from Dallas auction to Miami dealership"
 * "Pick up VIN 1HGBH41JXMN109186 from Copart Phoenix, deliver to 123 Main St Boston"
 * 
 * Features:
 * - Intelligent date parsing ("next week", "Monday", "ASAP")
 * - Location normalization (city names → full addresses)
 * - Vehicle identification (year/make/model, VIN)
 * - Price estimation integration
 * - Confidence scoring
 * - User feedback learning
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { FEATURE_FLAGS } from '../config/features';
import { googleMapsService } from './google-maps.service';
import { pricingService, VehicleType } from './pricing.service';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'] || '',
});

export interface NLShipmentInput {
  user_id: string;
  input_text: string;
  input_method: 'text' | 'voice' | 'email' | 'whatsapp';
  context?: {
    previous_shipments?: any[];
    user_preferences?: any;
  };
}

export interface ParsedShipmentData {
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    type?: string;
    condition?: 'running' | 'non_running';
  };
  pickup?: {
    location?: string;
    city?: string;
    state?: string;
    zip?: string;
    contact_name?: string;
    contact_phone?: string;
    date?: string;
    time?: string;
    special_instructions?: string;
  };
  delivery?: {
    location?: string;
    city?: string;
    state?: string;
    zip?: string;
    contact_name?: string;
    contact_phone?: string;
    date?: string;
    time?: string;
    special_instructions?: string;
  };
  preferences?: {
    enclosed_transport?: boolean;
    expedited?: boolean;
    price_preference?: 'budget' | 'standard' | 'premium';
  };
  metadata?: {
    urgency?: 'asap' | 'flexible' | 'scheduled';
    lot_number?: string;
    auction_house?: string;
  };
}

export interface NLParseResult {
  success: boolean;
  parsed_data?: ParsedShipmentData;
  confidence_score?: number;
  missing_fields?: string[];
  clarification_questions?: string[];
  estimated_price?: number;
  error?: string;
}

export class NaturalLanguageShipmentService {
  /**
   * Parse natural language input into structured shipment data
   */
  async parseShipment(input: NLShipmentInput): Promise<NLParseResult> {
    // Check feature flag
    if (!FEATURE_FLAGS.NATURAL_LANGUAGE) {
      return {
        success: false,
        error: 'Natural language shipment feature is not enabled',
      };
    }

    try {
      // Log the input for training
      const { data: promptLog } = await supabase
        .from('ai_shipment_prompts')
        .insert({
          user_id: input.user_id,
          input_method: input.input_method,
          prompt_text: input.input_text,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Parse with GPT-4
      const parseResult = await this.parseWithGPT4(input);

      // Update log with results
      if (promptLog) {
        await supabase
          .from('ai_shipment_prompts')
          .update({
            extracted_data: parseResult.parsed_data,
            confidence_score: parseResult.confidence_score,
            processing_completed_at: new Date().toISOString(),
          })
          .eq('id', promptLog.id);
      }

      return parseResult;
    } catch (error: any) {
      console.error('Error parsing natural language shipment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse input using GPT-4
   */
  private async parseWithGPT4(input: NLShipmentInput): Promise<NLParseResult> {
    try {
      if (!process.env['OPENAI_API_KEY']) {
        console.warn('OpenAI API key not configured, using fallback parsing');
        return this.fallbackParsing(input);
      }

      console.log(`Parsing natural language with GPT-4: "${input.input_text}"`);

      const systemPrompt = `You are Benji, an AI assistant for a vehicle shipping platform.
Extract structured shipment data from natural language input.

IMPORTANT RULES:
1. Extract only information explicitly stated or clearly implied
2. For dates: Parse relative dates ("next week" → ISO date 7 days from now, "Monday" → next Monday's ISO date)
3. For locations: Extract full location as stated - city name at minimum (e.g., "Los Angeles", "Dallas, TX", "123 Main St, Boston, MA")
4. For vehicles: Identify year (number), make (string), model (string), VIN if mentioned, condition (operable/inoperable)
5. For missing critical fields, note them in missing_fields array
6. Return confidence score 0.0-1.0 based on how complete and clear the information is

Return ONLY valid JSON with this EXACT structure:
{
  "vehicle": {"year": number|null, "make": string|null, "model": string|null, "vin": string|null, "type": string|null, "condition": string|null},
  "pickup": {"location": string|null, "date": string|null},
  "delivery": {"location": string|null, "date": string|null},
  "preferences": {"enclosed_transport": boolean|null, "expedited": boolean|null},
  "metadata": {"urgency": string|null, "notes": string|null}
}

ONLY include fields with actual values - use null for missing data. Location should be as specific as possible from the input.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.input_text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4');
      }

      const parsed = JSON.parse(content) as ParsedShipmentData;
      console.log('Parsed data:', JSON.stringify(parsed, null, 2));
      
      // Calculate confidence and identify missing fields
      const analysis = this.analyzeCompleteness(parsed);

      return {
        success: true,
        parsed_data: parsed,
        confidence_score: analysis.confidence,
        missing_fields: analysis.missingFields,
        clarification_questions: analysis.questions,
      };
    } catch (error: any) {
      console.error('GPT-4 parsing error:', error);
      
      // Fallback to regex parsing if OpenAI fails (rate limit, quota, etc)
      if (error.status === 429 || error.code === 'insufficient_quota') {
        console.warn('OpenAI quota exceeded, using fallback regex parsing');
        return this.fallbackParsing(input);
      }
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fallback regex-based parsing when OpenAI is unavailable
   */
  private fallbackParsing(input: NLShipmentInput): NLParseResult {
    console.log(`Using fallback parsing for: "${input.input_text}"`);

    const text = input.input_text.toLowerCase();
    
    const parsedData: ParsedShipmentData = {
      vehicle: {},
      pickup: {},
      delivery: {},
      preferences: {},
      metadata: {},
    };

    // Extract years (4 digits)
    const yearMatch = input.input_text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      parsedData.vehicle!.year = parseInt(yearMatch[0]);
    }

    // Extract common car makes
    const makes = ['toyota', 'honda', 'ford', 'chevrolet', 'chevy', 'tesla', 'bmw', 'mercedes', 'audi', 'lexus', 'nissan', 'mazda', 'subaru', 'volkswagen', 'vw', 'hyundai', 'kia', 'jeep', 'ram', 'dodge', 'gmc'];
    for (const make of makes) {
      if (text.includes(make)) {
        parsedData.vehicle!.make = make === 'chevy' ? 'Chevrolet' : make === 'vw' ? 'Volkswagen' : make.charAt(0).toUpperCase() + make.slice(1);
        break;
      }
    }

    // Extract common models
    const models = ['civic', 'accord', 'camry', 'corolla', 'model 3', 'model s', 'model x', 'model y', 'f-150', 'f150', 'silverado', 'tahoe', 'suburban'];
    for (const model of models) {
      if (text.includes(model)) {
        parsedData.vehicle!.model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Extract VIN (17 characters)
    const vinMatch = input.input_text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    if (vinMatch) {
      parsedData.vehicle!.vin = vinMatch[0];
    }

    // Extract locations (from/to patterns)
    const fromMatch = input.input_text.match(/from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)/i);
    if (fromMatch && fromMatch[1]) {
      parsedData.pickup!.location = fromMatch[1];
    }

    const toMatch = input.input_text.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)/i);
    if (toMatch && toMatch[1]) {
      parsedData.delivery!.location = toMatch[1];
    }

    // Detect urgency
    if (text.includes('asap') || text.includes('urgent') || text.includes('immediately')) {
      parsedData.metadata!.urgency = 'asap';
    } else if (text.includes('flexible') || text.includes('whenever')) {
      parsedData.metadata!.urgency = 'flexible';
    }

    // Detect transport preferences
    if (text.includes('enclosed')) {
      parsedData.preferences!.enclosed_transport = true;
    }
    if (text.includes('expedited') || text.includes('fast')) {
      parsedData.preferences!.expedited = true;
    }

    const analysis = this.analyzeCompleteness(parsedData);

    return {
      success: true,
      parsed_data: parsedData,
      confidence_score: analysis.confidence * 0.7, // Reduce confidence for fallback parsing
      missing_fields: analysis.missingFields,
      clarification_questions: analysis.questions,
    };
  }

  /**
   * Analyze completeness and generate clarification questions
   */
  private analyzeCompleteness(data: ParsedShipmentData): {
    confidence: number;
    missingFields: string[];
    questions: string[];
  } {
    const missingFields: string[] = [];
    const questions: string[] = [];
    let score = 0;
    let totalFields = 0;

    // Check vehicle info
    totalFields += 3;
    if (data.vehicle?.year) score++;
    else {
      missingFields.push('vehicle_year');
      questions.push('What year is the vehicle?');
    }

    if (data.vehicle?.make) score++;
    else {
      missingFields.push('vehicle_make');
      questions.push('What is the vehicle make (e.g., Toyota, Ford)?');
    }

    if (data.vehicle?.model) score++;
    else {
      missingFields.push('vehicle_model');
      questions.push('What is the vehicle model?');
    }

    // Check pickup location
    totalFields += 2;
    if (data.pickup?.location || data.pickup?.city) score++;
    else {
      missingFields.push('pickup_location');
      questions.push('Where should we pick up the vehicle?');
    }

    if (data.pickup?.state) score++;

    // Check delivery location
    totalFields += 2;
    if (data.delivery?.location || data.delivery?.city) score++;
    else {
      missingFields.push('delivery_location');
      questions.push('Where should we deliver the vehicle?');
    }

    if (data.delivery?.state) score++;

    const confidence = totalFields > 0 ? score / totalFields : 0;

    return {
      confidence: Math.round(confidence * 100) / 100,
      missingFields,
      questions: questions.slice(0, 3), // Limit to top 3 questions
    };
  }

  /**
   * Create shipment from parsed data
   */
  async createShipment(
    userId: string,
    parsedData: ParsedShipmentData
  ): Promise<{
    success: boolean;
    shipment_id?: string;
    shipment?: any;
    error?: string;
  }> {
    try {
      // Validate minimum required fields
      if (!parsedData.vehicle?.year || !parsedData.vehicle?.make) {
        return {
          success: false,
          error: 'Missing required vehicle information',
        };
      }

      if (!parsedData.pickup?.location) {
        return {
          success: false,
          error: 'Missing pickup location',
        };
      }

      if (!parsedData.delivery?.location) {
        return {
          success: false,
          error: 'Missing delivery location',
        };
      }

      // Calculate distance and price
      let estimatedPrice = 0;
      let distanceMiles = 0;
      
      try {
        // Get distance using Google Maps
        const directions = await googleMapsService.getDirections(
          parsedData.pickup.location,
          parsedData.delivery.location
        );
        
        distanceMiles = Math.round(directions.distance.value * 0.000621371); // meters to miles
        
        // Map vehicle type to pricing service type
        const vehicleType = this.mapVehicleTypeToPricing(parsedData.vehicle);
        
        // Calculate price
        const quote = await pricingService.calculateQuoteWithDynamicConfig({
          vehicleType,
          distanceMiles,
          isAccidentRecovery: false,
          vehicleCount: 1,
        });
        
        estimatedPrice = Math.round(quote.total);
      } catch (error) {
        console.error('Error calculating price:', error);
        // If pricing fails, use default minimum
        estimatedPrice = 150;
      }

      // Create shipment with proper column mapping
      const { data: shipment, error } = await supabase
        .from('shipments')
        .insert({
          client_id: userId,
          title: `${parsedData.vehicle.year || ''} ${parsedData.vehicle.make || ''} ${parsedData.vehicle.model || ''}`.trim() || 'Vehicle Shipment',
          description: `Shipment created via Benji AI`,
          vehicle_year: parsedData.vehicle.year,
          vehicle_make: parsedData.vehicle.make,
          vehicle_model: parsedData.vehicle.model,
          pickup_address: parsedData.pickup.location,
          delivery_address: parsedData.delivery.location,
          status: 'pending',
          estimated_price: estimatedPrice,
          distance: distanceMiles,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        shipment_id: shipment.id,
        shipment: shipment,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record user feedback on AI extraction
   */
  async recordFeedback(
    promptId: string,
    feedback: 'accurate' | 'needs_correction' | 'completely_wrong',
    corrections?: ParsedShipmentData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase
        .from('ai_shipment_prompts')
        .update({
          user_feedback: feedback,
          corrected_data: corrections,
          feedback_at: new Date().toISOString(),
        })
        .eq('id', promptId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Map parsed vehicle data to pricing service vehicle type
   */
  private mapVehicleTypeToPricing(vehicle: any): VehicleType {
    const make = vehicle?.make?.toLowerCase() || '';
    const model = vehicle?.model?.toLowerCase() || '';
    
    // Luxury brands
    if (['bmw', 'mercedes', 'audi', 'lexus', 'porsche', 'tesla', 'jaguar', 'maserati', 'bentley', 'rolls royce'].some(brand => make.includes(brand))) {
      return 'luxury';
    }
    
    // Motorcycles
    if (['motorcycle', 'bike', 'harley', 'yamaha', 'honda', 'kawasaki', 'suzuki', 'ducati'].some(type => make.includes(type) || model.includes(type))) {
      return 'motorcycle';
    }
    
    // Pickup trucks
    if (['f-150', 'f150', 'silverado', 'ram', 'tundra', 'tacoma', 'ranger', 'colorado', 'titan', 'frontier', 'pickup', 'truck'].some(type => model.includes(type))) {
      return 'pickup';
    }
    
    // Heavy vehicles
    if (['semi', 'truck', 'box truck', 'commercial', 'cargo van', 'sprinter'].some(type => model.includes(type))) {
      return 'heavy';
    }
    
    // SUVs
    if (['suv', 'explorer', 'tahoe', 'suburban', 'yukon', 'expedition', 'pilot', 'highlander', 'pathfinder', '4runner', 'traverse', 'durango'].some(type => model.includes(type))) {
      return 'suv';
    }
    
    // Default to sedan
    return 'sedan';
  }

  /**
   * Get AI training statistics
   */
  async getTrainingStats(): Promise<{
    total_prompts: number;
    accurate: number;
    needs_correction: number;
    completely_wrong: number;
    average_confidence: number;
    feedback_rate: number;
  }> {
    const { data } = await supabase
      .from('ai_shipment_prompts')
      .select('confidence_score, user_feedback');

    if (!data || data.length === 0) {
      return {
        total_prompts: 0,
        accurate: 0,
        needs_correction: 0,
        completely_wrong: 0,
        average_confidence: 0,
        feedback_rate: 0,
      };
    }

    const withFeedback = data.filter((p: any) => p.user_feedback !== null);
    
    return {
      total_prompts: data.length,
      accurate: withFeedback.filter((p: any) => p.user_feedback === 'accurate').length,
      needs_correction: withFeedback.filter((p: any) => p.user_feedback === 'needs_correction').length,
      completely_wrong: withFeedback.filter((p: any) => p.user_feedback === 'completely_wrong').length,
      average_confidence: data.reduce((sum: number, p: any) => 
        sum + (p.confidence_score || 0), 0) / data.length,
      feedback_rate: (withFeedback.length / data.length) * 100,
    };
  }

  /**
   * Suggest similar shipments based on parsed data
   */
  async getSimilarShipments(parsedData: ParsedShipmentData, limit: number = 5): Promise<any[]> {
    let query = supabase
      .from('shipments')
      .select('*')
      .limit(limit);

    // Match by vehicle make if available
    if (parsedData.vehicle?.make) {
      query = query.eq('vehicle_make', parsedData.vehicle.make);
    }

    // Match by pickup state if available
    if (parsedData.pickup?.state) {
      query = query.ilike('pickup_location', `%${parsedData.pickup.state}%`);
    }

    const { data } = await query;
    return data || [];
  }
}

export default NaturalLanguageShipmentService;
