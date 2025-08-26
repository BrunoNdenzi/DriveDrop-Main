import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingConfirmationProps = NativeStackScreenProps<
  RootStackParamList,
  'BookingConfirmation'
>;

export default function BookingConfirmationScreen({
  navigation,
}: BookingConfirmationProps) {
  const { state, resetForm, submitShipment } = useBooking();
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit shipment to Supabase when component mounts
  useEffect(() => {
    const submitToSupabase = async () => {
      if (shipmentId) return; // Already submitted

      try {
        setIsSubmitting(true);
        const shipment = await submitShipment();
        setShipmentId(shipment.id);
        console.log('Shipment created successfully:', shipment);
      } catch (error) {
        console.error('Error submitting shipment:', error);
        Alert.alert(
          'Submission Error',
          'There was an error submitting your shipment. Please try again or contact support.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    submitToSupabase();
  }, [submitShipment, navigation, shipmentId]);

  const handleDone = () => {
    resetForm();
    navigation.reset({
      index: 0,
      routes: [{ name: 'ClientTabs' }],
    });
  };

  const handleViewShipments = () => {
    resetForm();
    navigation.reset({
      index: 0,
      routes: [{ name: 'ClientTabs' }],
    });
    // In a real app, you'd navigate to the shipments tab after reset
  };

  const generateBookingReference = () => {
    return shipmentId
      ? `DD${shipmentId.substring(0, 6).toUpperCase()}`
      : `DD${Date.now().toString().slice(-6)}`;
  };

  const bookingRef = generateBookingReference();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.scrollContent}>
          {/* Success Header */}
          <View style={styles.successHeader}>
            <View style={styles.successIcon}>
              <MaterialIcons
                name={isSubmitting ? 'hourglass-empty' : 'check-circle'}
                size={64}
                color={isSubmitting ? Colors.warning : Colors.success}
              />
            </View>
            <Text style={styles.successTitle}>
              {isSubmitting
                ? 'Submitting Request...'
                : 'Booking Request Submitted!'}
            </Text>
            <Text style={styles.successSubtitle}>
              {isSubmitting
                ? 'Please wait while we process your shipment request...'
                : 'Your vehicle shipment request has been successfully submitted and is being reviewed by our team.'}
            </Text>
          </View>

          {/* Booking Details */}
          <Card variant="default" padding="lg" style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Booking Reference</Text>
            <View style={styles.referenceRow}>
              <Text style={styles.referenceNumber}>{bookingRef}</Text>
              <TouchableOpacity style={styles.copyButton}>
                <MaterialIcons
                  name="content-copy"
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.referenceNote}>
              Save this reference number for tracking your shipment
            </Text>
          </Card>

          {/* Quick Summary */}
          <Card variant="default" padding="lg" style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Shipment Summary</Text>

            <View style={styles.summaryRow}>
              <MaterialIcons
                name="person"
                size={20}
                color={Colors.text.secondary}
              />
              <Text style={styles.summaryLabel}>Customer:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.customerDetails.fullName || 'Not provided'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <MaterialIcons
                name="directions-car"
                size={20}
                color={Colors.text.secondary}
              />
              <Text style={styles.summaryLabel}>Vehicle:</Text>
              <Text style={styles.summaryValue}>
                {`${state.formData.vehicleInformation.year || ''} ${state.formData.vehicleInformation.make || ''} ${state.formData.vehicleInformation.model || ''}`.trim() ||
                  'Not provided'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <MaterialIcons
                name="location-on"
                size={20}
                color={Colors.text.secondary}
              />
              <Text style={styles.summaryLabel}>Pickup:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.pickupDetails.address || 'Not provided'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <MaterialIcons
                name="flag"
                size={20}
                color={Colors.text.secondary}
              />
              <Text style={styles.summaryLabel}>Delivery:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.deliveryDetails.address || 'Not provided'}
              </Text>
            </View>
          </Card>

          {/* Next Steps */}
          <Card variant="default" padding="lg" style={styles.stepsCard}>
            <Text style={styles.sectionTitle}>What happens next?</Text>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIcon}>
                <MaterialIcons name="email" size={20} color={Colors.primary} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Email Confirmation</Text>
                <Text style={styles.timelineDescription}>
                  You'll receive a confirmation email within 15 minutes
                </Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIcon}>
                <MaterialIcons
                  name="assignment"
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Quote Review</Text>
                <Text style={styles.timelineDescription}>
                  Our team will review your request and prepare a detailed quote
                </Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIcon}>
                <MaterialIcons name="phone" size={20} color={Colors.primary} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Contact & Scheduling</Text>
                <Text style={styles.timelineDescription}>
                  We'll contact you within 24 hours to discuss pricing and
                  schedule pickup
                </Text>
              </View>
            </View>
          </Card>

          {/* Contact Info */}
          <Card variant="default" padding="lg" style={styles.contactCard}>
            <Text style={styles.sectionTitle}>Need Help?</Text>
            <Text style={styles.contactText}>
              If you have any questions about your booking, feel free to contact
              us:
            </Text>

            <TouchableOpacity style={styles.contactRow}>
              <MaterialIcons name="phone" size={20} color={Colors.primary} />
              <Text style={styles.contactValue}>1-800-DRIVEDROP</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactRow}>
              <MaterialIcons name="email" size={20} color={Colors.primary} />
              <Text style={styles.contactValue}>support@drivedrop.com</Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          title="View My Shipments"
          variant="outline"
          onPress={handleViewShipments}
          style={styles.actionButton}
        />
        <Button
          title="Done"
          variant="primary"
          onPress={handleDone}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[6],
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: Spacing[8],
  },
  successIcon: {
    marginBottom: Spacing[4],
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing[3],
  },
  successSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.base,
    paddingHorizontal: Spacing[4],
  },
  detailsCard: {
    marginBottom: Spacing[4],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[4],
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[2],
  },
  referenceNumber: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: Spacing[2],
  },
  referenceNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  summaryCard: {
    marginBottom: Spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginLeft: Spacing[2],
    minWidth: 80,
  },
  summaryValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    flex: 1,
    marginLeft: Spacing[2],
  },
  stepsCard: {
    marginBottom: Spacing[4],
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: Spacing[4],
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  timelineDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  contactCard: {
    marginBottom: Spacing[4],
  },
  contactText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[4],
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  contactValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
    marginLeft: Spacing[2],
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: Spacing[2],
  },
  bottomSpacing: {
    height: Spacing[6],
  },
});
