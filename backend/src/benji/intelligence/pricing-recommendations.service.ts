/**
 * Pricing Policy Recommendations Service
 * Phase 3: Operational Memory Infrastructure
 * 
 * Purpose: Generate policy recommendations based on performance data
 * Pattern: Read performance data → Detect patterns → Output recommendations
 * 
 * INFRASTRUCTURE ONLY (OUTPUT-ONLY):
 * - Analyzes performance metrics to detect optimization opportunities
 * - Generates structured recommendations with evidence and reasoning
 * - NEVER applies recommendations to pricing_config
 * - NEVER modifies pricing behavior or business policies
 * - Output only - recommendations require human review and approval
 */

import { logger } from '@utils/logger';
import { pricingPerformanceService, type PerformanceMetrics } from './pricing-performance.service';

/**
 * Policy recommendation types
 */
export type PolicyRecommendationType =
  | 'confidence_threshold'        // Adjust min confidence threshold
  | 'demand_premium'              // Adjust demand-based premium
  | 'loyalty_discount'            // Adjust loyalty discount
  | 'conversion_boost'            // Adjust conversion optimization discount
  | 'momentum_premium'            // Adjust momentum-based premium
  | 'historical_alignment'        // Adjust historical alignment weight
  | 'max_adjustment';             // Adjust max price adjustment limit

/**
 * Confidence level for recommendation
 */
export type RecommendationConfidence = 'low' | 'medium' | 'high';

/**
 * Policy recommendation output
 */
export interface PolicyRecommendation {
  id: string;
  type: PolicyRecommendationType;
  currentValue: number;
  recommendedValue: number;
  changeMagnitude: number;          // Absolute change
  changePercent: number;            // Percentage change
  reasoning: string;
  confidence: RecommendationConfidence;
  evidence: {
    sampleSize: number;
    performanceImpact: string;
    riskLevel: 'low' | 'medium' | 'high';
    supportingData: Record<string, any>;
  };
  generatedAt: Date;
  requiresApproval: boolean;        // True if change > threshold
}

/**
 * Pattern detection result
 */
interface PatternDetection {
  detected: boolean;
  severity: 'low' | 'medium' | 'high';
  description: string;
  supportingData: Record<string, any>;
}

export class PricingRecommendationsService {
  /**
   * Generate all policy recommendations based on recent performance
   * OUTPUT-ONLY: Returns recommendations, does not apply them
   */
  async generateRecommendations(timeWindowDays: number = 30): Promise<PolicyRecommendation[]> {
    try {
      // Get performance metrics
      const metrics = await pricingPerformanceService.getPerformanceMetrics(timeWindowDays);
      
      // Check if we have enough data
      if (metrics.dataQuality === 'insufficient') {
        logger.warn('⚠️ Insufficient data for recommendations', {
          sampleSize: metrics.sampleSize,
          timeWindowDays,
        });
        return [];
      }
      
      const recommendations: PolicyRecommendation[] = [];
      
      // Pattern 1: Intelligence underperforming → Adjust confidence threshold
      const confidencePattern = this.detectConfidenceThresholdPattern(metrics);
      if (confidencePattern.detected) {
        recommendations.push(this.generateConfidenceRecommendation(metrics, confidencePattern));
      }
      
      // Pattern 2: Confidence calibration mismatch → Adjust threshold
      const calibrationPattern = this.detectCalibrationPattern(metrics);
      if (calibrationPattern.detected) {
        recommendations.push(this.generateCalibrationRecommendation(metrics, calibrationPattern));
      }
      
      // Pattern 3: Intelligence consistently better → Lower threshold (expand usage)
      const expansionPattern = this.detectExpansionOpportunity(metrics);
      if (expansionPattern.detected) {
        recommendations.push(this.generateExpansionRecommendation(metrics, expansionPattern));
      }
      
      logger.info('💡 Recommendations generated', {
        count: recommendations.length,
        timeWindowDays,
        sampleSize: metrics.sampleSize,
      });
      
      return recommendations;
    } catch (error) {
      logger.error('❌ Failed to generate recommendations', {
        timeWindowDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Get a specific recommendation by type
   * OUTPUT-ONLY: Returns recommendation if available
   */
  async getRecommendation(
    type: PolicyRecommendationType,
    timeWindowDays: number = 30
  ): Promise<PolicyRecommendation | null> {
    const recommendations = await this.generateRecommendations(timeWindowDays);
    return recommendations.find(r => r.type === type) || null;
  }
  
  /**
   * Detect if confidence threshold should be adjusted
   * Pattern: Intelligence consistently underperforms baseline
   */
  private detectConfidenceThresholdPattern(metrics: PerformanceMetrics): PatternDetection {
    if (!metrics.hasIntelligentData || metrics.intelligent.total < 20) {
      return { detected: false, severity: 'low', description: 'Insufficient intelligent quote data', supportingData: {} };
    }
    
    const conversionGap = metrics.baseline.conversionRate - metrics.intelligent.conversionRate;
    
    // Pattern: Intelligence conversion rate is 5+ percentage points below baseline
    if (conversionGap >= 5) {
      return {
        detected: true,
        severity: conversionGap >= 10 ? 'high' : 'medium',
        description: 'Intelligence underperforming baseline significantly',
        supportingData: {
          baselineConversion: metrics.baseline.conversionRate,
          intelligentConversion: metrics.intelligent.conversionRate,
          gap: conversionGap,
        },
      };
    }
    
    return { detected: false, severity: 'low', description: 'No significant underperformance', supportingData: {} };
  }
  
  /**
   * Generate confidence threshold recommendation
   */
  private generateConfidenceRecommendation(
    metrics: PerformanceMetrics,
    pattern: PatternDetection
  ): PolicyRecommendation {
    const currentValue = 50;  // Assume default threshold
    const recommendedValue = pattern.severity === 'high' ? 70 : 60;
    
    return {
      id: crypto.randomUUID(),
      type: 'confidence_threshold',
      currentValue,
      recommendedValue,
      changeMagnitude: recommendedValue - currentValue,
      changePercent: ((recommendedValue - currentValue) / currentValue) * 100,
      reasoning: `Intelligence conversion rate (${metrics.intelligent.conversionRate.toFixed(1)}%) is ${pattern.supportingData['gap'].toFixed(1)} percentage points below baseline (${metrics.baseline.conversionRate.toFixed(1)}%). Recommend increasing confidence threshold to ${recommendedValue}% to reduce low-quality intelligent pricing decisions.`,
      confidence: pattern.severity === 'high' ? 'high' : 'medium',
      evidence: {
        sampleSize: metrics.intelligent.total,
        performanceImpact: `${pattern.supportingData['gap'].toFixed(1)}% conversion rate gap`,
        riskLevel: pattern.severity === 'high' ? 'high' : 'medium',
        supportingData: pattern.supportingData,
      },
      generatedAt: new Date(),
      requiresApproval: Math.abs(recommendedValue - currentValue) > 10,
    };
  }
  
  /**
   * Detect confidence calibration mismatch
   * Pattern: Predicted confidence doesn't match actual booking rates
   */
  private detectCalibrationPattern(metrics: PerformanceMetrics): PatternDetection {
    const { high } = metrics.confidenceCalibration;
    
    // Check if high confidence is actually performing poorly
    if (high.sampleSize >= 10) {
      const calibrationError = Math.abs(high.predicted - high.actual);
      
      if (calibrationError > 20) {
        return {
          detected: true,
          severity: 'high',
          description: 'High confidence predictions are miscalibrated',
          supportingData: {
            predicted: high.predicted,
            actual: high.actual,
            error: calibrationError,
            sampleSize: high.sampleSize,
          },
        };
      }
    }
    
    return { detected: false, severity: 'low', description: 'Calibration within acceptable range', supportingData: {} };
  }
  
  /**
   * Generate calibration recommendation
   */
  private generateCalibrationRecommendation(
    _metrics: PerformanceMetrics,
    pattern: PatternDetection
  ): PolicyRecommendation {
    const currentValue = 50;
    const recommendedValue = 65;  // Increase threshold if high confidence is overconfident
    
    return {
      id: crypto.randomUUID(),
      type: 'confidence_threshold',
      currentValue,
      recommendedValue,
      changeMagnitude: recommendedValue - currentValue,
      changePercent: ((recommendedValue - currentValue) / currentValue) * 100,
      reasoning: `High confidence quotes are predicted to book at ${pattern.supportingData['predicted']}% but actually book at ${pattern.supportingData['actual'].toFixed(1)}%. This ${pattern.supportingData['error'].toFixed(1)}% calibration error suggests the confidence model is overconfident. Recommend raising threshold to ${recommendedValue}% to improve accuracy.`,
      confidence: 'high',
      evidence: {
        sampleSize: pattern.supportingData['sampleSize'],
        performanceImpact: `${pattern.supportingData['error'].toFixed(1)}% calibration error`,
        riskLevel: 'high',
        supportingData: pattern.supportingData,
      },
      generatedAt: new Date(),
      requiresApproval: true,
    };
  }
  
  /**
   * Detect expansion opportunity
   * Pattern: Intelligence consistently outperforms baseline
   */
  private detectExpansionOpportunity(metrics: PerformanceMetrics): PatternDetection {
    if (!metrics.hasIntelligentData || metrics.intelligent.total < 50) {
      return { detected: false, severity: 'low', description: 'Insufficient data for expansion', supportingData: {} };
    }
    
    const conversionGap = metrics.intelligent.conversionRate - metrics.baseline.conversionRate;
    const revenueGap = metrics.intelligent.avgRevenue - metrics.baseline.avgRevenue;
    
    // Pattern: Intelligence consistently better on both conversion AND revenue
    if (conversionGap >= 3 && revenueGap >= 0) {
      return {
        detected: true,
        severity: conversionGap >= 5 ? 'high' : 'medium',
        description: 'Intelligence consistently outperforming baseline',
        supportingData: {
          conversionGap,
          revenueGap,
          intelligentConversion: metrics.intelligent.conversionRate,
          baselineConversion: metrics.baseline.conversionRate,
        },
      };
    }
    
    return { detected: false, severity: 'low', description: 'No clear expansion opportunity', supportingData: {} };
  }
  
  /**
   * Generate expansion recommendation
   */
  private generateExpansionRecommendation(
    metrics: PerformanceMetrics,
    pattern: PatternDetection
  ): PolicyRecommendation {
    const currentValue = 50;
    const recommendedValue = 40;  // Lower threshold to expand usage
    
    return {
      id: crypto.randomUUID(),
      type: 'confidence_threshold',
      currentValue,
      recommendedValue,
      changeMagnitude: recommendedValue - currentValue,
      changePercent: ((recommendedValue - currentValue) / currentValue) * 100,
      reasoning: `Intelligence conversion rate (${metrics.intelligent.conversionRate.toFixed(1)}%) exceeds baseline (${metrics.baseline.conversionRate.toFixed(1)}%) by ${pattern.supportingData['conversionGap'].toFixed(1)} percentage points, with ${pattern.supportingData['revenueGap'] >= 0 ? 'higher' : 'comparable'} revenue. Recommend lowering confidence threshold to ${recommendedValue}% to expand intelligent pricing usage while maintaining quality.`,
      confidence: pattern.severity === 'high' ? 'high' : 'medium',
      evidence: {
        sampleSize: metrics.intelligent.total,
        performanceImpact: `+${pattern.supportingData['conversionGap'].toFixed(1)}% conversion rate improvement`,
        riskLevel: 'low',
        supportingData: pattern.supportingData,
      },
      generatedAt: new Date(),
      requiresApproval: Math.abs(recommendedValue - currentValue) > 10,
    };
  }
}

// Export singleton instance
export const pricingRecommendationsService = new PricingRecommendationsService();
