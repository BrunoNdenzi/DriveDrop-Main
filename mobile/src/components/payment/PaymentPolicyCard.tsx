import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Card } from '../ui/Card';
import {
  Colors,
  Spacing,
  Typography,
  NeutralColors,
} from '../../constants/DesignSystem';
import { FontAwesome } from '@expo/vector-icons';
import { formatCurrency } from '../../utils/formatters';

interface PaymentPolicyCardProps {
  totalAmount: number;
  initialAmount?: number;
  remainingAmount?: number;
  refundDeadline?: string;
  isRefundable?: boolean;
  paymentType?: 'initial' | 'final' | 'complete';
}

/**
 * PaymentPolicyCard Component
 *
 * Displays the payment policy information including:
 * - 20% initial payment / 80% final payment breakdown
 * - Refund eligibility status
 * - Visual representation of payment split
 */
export function PaymentPolicyCard({
  totalAmount,
  initialAmount,
  remainingAmount,
  refundDeadline,
  isRefundable = false,
  paymentType = 'initial',
}: PaymentPolicyCardProps) {
  // Calculate amounts if not provided
  const calculatedInitialAmount =
    initialAmount || Math.round(totalAmount * 0.2);
  const calculatedRemainingAmount =
    remainingAmount || Math.round(totalAmount * 0.8);

  // Calculate refund time remaining
  const getRefundTimeRemaining = () => {
    if (!refundDeadline || !isRefundable) return null;

    const deadline = new Date(refundDeadline);
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();

    if (timeDiff <= 0) return 'Expired';

    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  const refundTimeRemaining = getRefundTimeRemaining();

  return (
    <Card style={styles.container}>
      <View style={styles.headerContainer}>
        <FontAwesome name="money" size={24} color={Colors.primary} />
        <Text style={styles.headerText}>Payment Policy</Text>
      </View>

      <View style={styles.divider} />

      {/* Payment breakdown visualization */}
      <View style={styles.paymentBreakdownContainer}>
        <View style={styles.paymentVisualization}>
          <View style={styles.initialPaymentBar}>
            <Text style={styles.paymentBarText}>20%</Text>
          </View>
          <View style={styles.finalPaymentBar}>
            <Text style={styles.paymentBarText}>80%</Text>
          </View>
        </View>

        <View style={styles.amountsContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Initial Payment (20%)</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(calculatedInitialAmount / 100)}
            </Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Final Payment (80%)</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(calculatedRemainingAmount / 100)}
            </Text>
          </View>

          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totalAmount / 100)}
            </Text>
          </View>
        </View>
      </View>

      {/* Refund policy */}
      <View style={styles.refundPolicyContainer}>
        <View style={styles.refundHeaderRow}>
          <FontAwesome name="refresh" size={16} color={Colors.secondary} />
          <Text style={styles.refundHeaderText}>Refund Policy</Text>
        </View>

        <Text style={styles.refundPolicyText}>
          Initial payments (20%) are refundable within 1 hour of booking. Final
          payments (80%) are non-refundable.
        </Text>

        {isRefundable && refundTimeRemaining && paymentType === 'initial' && (
          <View style={styles.refundStatusContainer}>
            <Text style={styles.refundStatusLabel}>Refund available for:</Text>
            <Text style={styles.refundTimeRemaining}>
              {refundTimeRemaining}
            </Text>
          </View>
        )}

        {!isRefundable && paymentType === 'initial' && (
          <View style={styles.refundStatusContainer}>
            <Text style={styles.refundStatusExpired}>
              Refund period has expired
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing[4],
    marginVertical: Spacing[2],
    padding: Spacing[4],
    borderRadius: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  headerText: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    marginLeft: Spacing[2],
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[2],
  },
  paymentBreakdownContainer: {
    marginVertical: Spacing[4],
  },
  paymentVisualization: {
    flexDirection: 'row',
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: Spacing[4],
  },
  initialPaymentBar: {
    width: '20%',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalPaymentBar: {
    width: '80%',
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentBarText: {
    color: NeutralColors.white,
    fontWeight: 'bold',
    fontSize: Typography.fontSize.base,
  },
  amountsContainer: {
    marginTop: Spacing[2],
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing[1],
  },
  amountLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  amountValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: 'bold',
  },
  totalRow: {
    marginTop: Spacing[2],
    paddingTop: Spacing[2],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: Typography.fontSize['xl'],
    color: Colors.primary,
  },
  refundPolicyContainer: {
    marginTop: Spacing[4],
    padding: Spacing[2],
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  refundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  refundHeaderText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: Spacing[1],
    color: Colors.secondary,
  },
  refundPolicyText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  refundStatusContainer: {
    marginTop: Spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refundStatusLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  refundTimeRemaining: {
    fontSize: Typography.fontSize.base,
    color: Colors.success,
    fontWeight: 'bold',
  },
  refundStatusExpired: {
    fontSize: Typography.fontSize.base,
    color: Colors.error,
    fontWeight: 'bold',
  },
});
