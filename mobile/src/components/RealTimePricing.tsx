/**
 * Real-time pricing estimation component
 * Provides progressive pricing feedback as user enters shipment data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { pricingService } from '../services/pricingService';

// Simple debounce function
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

interface PriceEstimate {
  total: number;
  range: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
  type: 'estimate' | 'quote';
}

interface PricingData {
  estimate: PriceEstimate;
  breakdown: {
    baseRatePerMile: number;
    distanceBand: 'short' | 'mid' | 'long';
    rawBasePrice: number;
    bulkDiscountPercent: number;
    bulkDiscountAmount: number;
    surgeMultiplier: number;
    total: number;
  };
  distance: {
    miles: number;
    source: 'haversine' | 'google_maps' | 'user_provided';
    confidence: 'low' | 'medium' | 'high';
  };
  factors: {
    has_accurate_distance: boolean;
    has_coordinates: boolean;
    has_addresses: boolean;
  };
  expires_at?: string;
}

interface RealTimePricingProps {
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupLocation?: { lat: number; lng: number };
  deliveryLocation?: { lat: number; lng: number };
  pickupZip?: string;
  deliveryZip?: string;
  pickupState?: string;
  deliveryState?: string;
  vehicleType: 'sedan' | 'suv' | 'truck';
  vehicleCount?: number;
  isAccidentRecovery?: boolean;
  onPriceUpdate?: (pricing: PricingData | null) => void;
  showDetailed?: boolean;
  autoUpdate?: boolean;
}

export default function RealTimePricing({
  pickupAddress,
  deliveryAddress,
  pickupLocation,
  deliveryLocation,
  pickupZip,
  deliveryZip,
  pickupState,
  deliveryState,
  vehicleType,
  vehicleCount = 1,
  isAccidentRecovery = false,
  onPriceUpdate,
  showDetailed = false,
  autoUpdate = true,
}: RealTimePricingProps) {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  // Debounced API call for real-time updates
  const debouncedGetEstimate = useCallback(
    debounce(async (params: any) => {
      if (!autoUpdate) return;
      
      try {
        setLoading(true);
        setError(null);

        const result = await pricingService.getProgressiveEstimate(params);
        setPricing(result);
        onPriceUpdate?.(result);

        // Animate in the price
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (err) {
        console.error('Pricing estimate error:', err);
        setError('Unable to get price estimate');
      } finally {
        setLoading(false);
      }
    }, 800),
    [autoUpdate, onPriceUpdate, fadeAnim, scaleAnim]
  );

  // Trigger estimate when relevant data changes
  useEffect(() => {
    if (!vehicleType) return;

    const hasMinimalData = pickupAddress || deliveryAddress || pickupLocation || deliveryLocation || pickupZip || deliveryZip;
    
    if (hasMinimalData) {
      const params = {
        pickupAddress,
        deliveryAddress,
        pickupLocation,
        deliveryLocation,
        pickupZip,
        deliveryZip,
        pickupState,
        deliveryState,
        vehicleType,
        vehicleCount,
        isAccidentRecovery,
      };

      debouncedGetEstimate(params);
    } else {
      setPricing(null);
      onPriceUpdate?.(null);
    }
  }, [
    pickupAddress,
    deliveryAddress,
    pickupLocation,
    deliveryLocation,
    pickupZip,
    deliveryZip,
    pickupState,
    deliveryState,
    vehicleType,
    vehicleCount,
    isAccidentRecovery,
    debouncedGetEstimate,
    onPriceUpdate,
  ]);

  // Manual refresh function
  const refreshEstimate = async () => {
    if (!vehicleType) return;

    const hasMinimalData = pickupAddress || deliveryAddress || pickupLocation || deliveryLocation;
    
    if (!hasMinimalData) {
      setError('Please enter pickup and delivery information');
      return;
    }

    const params = {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      pickup_location: pickupLocation,
      delivery_location: deliveryLocation,
      vehicle_type: vehicleType,
      vehicle_count: vehicleCount,
      is_accident_recovery: isAccidentRecovery,
      is_estimate: false, // Request quote instead of estimate
    };

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/pricing/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth header here
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to get price quote');
      }

      const result = await response.json();
      setPricing(result.data);
      onPriceUpdate?.(result.data);
    } catch (err) {
      console.error('Pricing quote error:', err);
      setError('Unable to get price quote');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return Colors.success;
      case 'medium': return Colors.warning;
      case 'low': return Colors.error;
      default: return Colors.text.secondary;
    }
  };

  const getConfidenceText = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'Accurate estimate';
      case 'medium': return 'Good estimate';
      case 'low': return 'Rough estimate';
      default: return 'Estimate';
    }
  };

  if (loading && !pricing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Getting price estimate...</Text>
        </View>
      </View>
    );
  }

  if (error && !pricing) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refreshEstimate} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!pricing) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderContainer}>
          <MaterialIcons name="attach-money" size={24} color={Colors.text.secondary} />
          <Text style={styles.placeholderText}>
            Enter pickup and delivery locations to see price estimate
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.priceContainer}>
        <View style={styles.priceHeader}>
          <View style={styles.priceMainInfo}>
            <Text style={styles.priceLabel}>
              {pricing.estimate.type === 'quote' ? 'Quote' : 'Estimate'}
            </Text>
            <Text style={styles.priceAmount}>${pricing.estimate.total}</Text>
            {pricing.estimate.confidence !== 'high' && (
              <Text style={styles.priceRange}>
                ${pricing.estimate.range.min} - ${pricing.estimate.range.max}
              </Text>
            )}
          </View>
          
          <View style={styles.priceActions}>
            {loading && (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingIcon} />
            )}
            <TouchableOpacity onPress={refreshEstimate} style={styles.refreshButton}>
              <MaterialIcons name="refresh" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {showDetailed && (
              <TouchableOpacity 
                onPress={() => setExpanded(!expanded)} 
                style={styles.expandButton}
              >
                <MaterialIcons 
                  name={expanded ? "expand-less" : "expand-more"} 
                  size={20} 
                  color={Colors.primary} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.confidenceContainer}>
          <View 
            style={[
              styles.confidenceIndicator, 
              { backgroundColor: getConfidenceColor(pricing.estimate.confidence) }
            ]} 
          />
          <Text style={[styles.confidenceText, { color: getConfidenceColor(pricing.estimate.confidence) }]}>
            {getConfidenceText(pricing.estimate.confidence)}
          </Text>
          <Text style={styles.distanceText}>
            {pricing.distance.miles} miles
          </Text>
        </View>

        {expanded && showDetailed && (
          <View style={styles.detailedContainer}>
            <Text style={styles.detailedTitle}>Price Breakdown</Text>
            
            <View style={styles.detailedRow}>
              <Text style={styles.detailedLabel}>Base Rate</Text>
              <Text style={styles.detailedValue}>
                ${pricing.breakdown.baseRatePerMile}/mile
              </Text>
            </View>
            
            <View style={styles.detailedRow}>
              <Text style={styles.detailedLabel}>Distance</Text>
              <Text style={styles.detailedValue}>
                {pricing.distance.miles} miles ({pricing.breakdown.distanceBand})
              </Text>
            </View>
            
            <View style={styles.detailedRow}>
              <Text style={styles.detailedLabel}>Raw Price</Text>
              <Text style={styles.detailedValue}>
                ${pricing.breakdown.rawBasePrice}
              </Text>
            </View>
            
            {pricing.breakdown.bulkDiscountAmount > 0 && (
              <View style={styles.detailedRow}>
                <Text style={[styles.detailedLabel, { color: Colors.success }]}>
                  Bulk Discount ({pricing.breakdown.bulkDiscountPercent}%)
                </Text>
                <Text style={[styles.detailedValue, { color: Colors.success }]}>
                  -${pricing.breakdown.bulkDiscountAmount}
                </Text>
              </View>
            )}
            
            <View style={[styles.detailedRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${pricing.breakdown.total}</Text>
            </View>

            {pricing.expires_at && (
              <Text style={styles.expiryText}>
                Quote expires: {new Date(pricing.expires_at).toLocaleString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  loadingIcon: {
    marginRight: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.error,
    borderRadius: 6,
  },
  retryText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  priceContainer: {
    flex: 1,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  priceMainInfo: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  priceRange: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  priceActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginLeft: 4,
  },
  expandButton: {
    padding: 8,
    marginLeft: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  detailedContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  detailedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailedLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  detailedValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  expiryText: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
