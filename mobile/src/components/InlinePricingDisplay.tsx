import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface InlinePricingDisplayProps {
  estimatedPrice?: number;
  distanceMiles?: number;
  isAccidentRecovery?: boolean;
  onRecalculate: () => Promise<void> | void;
  editable?: boolean;
}

export default function InlinePricingDisplay({
  estimatedPrice,
  distanceMiles,
  isAccidentRecovery,
  onRecalculate,
  editable = true,
}: InlinePricingDisplayProps) {
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await onRecalculate();
    } catch (error) {
      console.error('Error recalculating pricing:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Not calculated';
    return `$${price.toFixed(2)}`;
  };

  const getPricingTier = () => {
    if (!distanceMiles) return 'Unknown';
    
    if (distanceMiles <= 500) return 'Short Distance';
    if (distanceMiles <= 1500) return 'Mid Distance';
    return 'Long Distance';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Pricing</Text>
      
      <View style={styles.pricingContainer}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Estimated Price</Text>
          <Text style={[
            styles.priceValue,
            !estimatedPrice && styles.noPrice
          ]}>
            {formatPrice(estimatedPrice)}
          </Text>
        </View>

        {editable && (
          <TouchableOpacity
            style={[styles.recalculateButton, recalculating && styles.buttonDisabled]}
            onPress={handleRecalculate}
            disabled={recalculating}
          >
            {recalculating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="refresh" size={18} color={Colors.primary} />
            )}
            <Text style={styles.recalculateText}>
              {recalculating ? 'Updating...' : 'Recalculate'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pricing Details */}
      <View style={styles.detailsContainer}>
        {distanceMiles && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>
              {distanceMiles.toFixed(0)} miles ({getPricingTier()})
            </Text>
          </View>
        )}

        {isAccidentRecovery && (
          <View style={styles.detailRow}>
            <MaterialIcons name="warning" size={16} color={Colors.warning} />
            <Text style={[styles.detailValue, styles.warningText]}>
              Accident Recovery Service
            </Text>
          </View>
        )}

        <View style={styles.pricingNotes}>
          <Text style={styles.noteText}>
            ΓÇó Pricing is calculated based on distance, vehicle type, and service requirements
          </Text>
          <Text style={styles.noteText}>
            ΓÇó Final price may vary based on actual conditions and fuel costs
          </Text>
          {isAccidentRecovery && (
            <Text style={styles.noteText}>
              ΓÇó Accident recovery includes specialized handling and insurance
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background + '50',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  pricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  noPrice: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    fontWeight: 'normal',
  },
  recalculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
    borderWidth: 1,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  recalculateText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  warningText: {
    color: Colors.warning,
    fontWeight: '500',
    marginLeft: 6,
  },
  pricingNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noteText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
    marginBottom: 4,
  },
});
