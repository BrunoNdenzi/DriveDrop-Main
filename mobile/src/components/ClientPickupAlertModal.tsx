import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';

interface ClientPickupAlertModalProps {
  visible: boolean;
  onClose: () => void;
  verification: any;
  shipmentId: string;
}

export default function ClientPickupAlertModal({
  visible,
  onClose,
  verification,
  shipmentId,
}: ClientPickupAlertModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!visible || !verification) return;

    // Calculate time remaining based on when driver submitted
    const submittedAt = new Date(verification.verification_completed_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - submittedAt) / 1000);
    const remaining = Math.max(0, 300 - elapsed);
    
    setTimeRemaining(remaining);

    // Auto-approve if time runs out
    if (remaining === 0) {
      handleAutoApprove();
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoApprove();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, verification]);

  const handleAutoApprove = async () => {
    try {
      await handleApprove(true);
    } catch (error) {
      console.error('Error auto-approving:', error);
    }
  };

  const handleApprove = async (isAutomatic = false) => {
    if (responding) return;
    
    setResponding(true);

    try {
      const { error } = await supabase
        .from('pickup_verifications')
        .update({
          client_response: 'approved',
          client_responded_at: new Date().toISOString(),
          client_response_notes: isAutomatic ? 'Auto-approved after 5 minutes' : 'Client approved verification',
        })
        .eq('id', verification.id);

      if (error) throw error;

      // Update shipment status to picked_up
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ status: 'picked_up' })
        .eq('id', shipmentId);

      if (shipmentError) throw shipmentError;

      Alert.alert(
        'Verification Approved',
        isAutomatic 
          ? 'The verification has been automatically approved. Your shipment will proceed as planned.'
          : 'Thank you for approving the verification. Your shipment will proceed as planned.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error approving verification:', error);
      Alert.alert('Error', 'Failed to approve verification. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const handleDispute = () => {
    Alert.alert(
      'Dispute Verification',
      'Disputing the verification will cancel the shipment and initiate a full refund. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispute & Cancel',
          style: 'destructive',
          onPress: async () => {
            setResponding(true);

            try {
              // Update verification
              const { error: verificationError } = await supabase
                .from('pickup_verifications')
                .update({
                  client_response: 'disputed',
                  client_responded_at: new Date().toISOString(),
                  client_response_notes: 'Client disputed verification - major discrepancies',
                })
                .eq('id', verification.id);

              if (verificationError) throw verificationError;

              // Cancel shipment
              const { error: shipmentError } = await supabase
                .from('shipments')
                .update({ 
                  status: 'cancelled',
                  cancellation_reason: 'Client disputed pickup verification',
                })
                .eq('id', shipmentId);

              if (shipmentError) throw shipmentError;

              Alert.alert(
                'Verification Disputed',
                'The shipment has been cancelled and a full refund will be processed within 5-10 business days.',
                [{ text: 'OK', onPress: onClose }]
              );
            } catch (error) {
              console.error('Error disputing verification:', error);
              Alert.alert('Error', 'Failed to dispute verification. Please try again.');
            } finally {
              setResponding(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!verification) return null;

  const photos = Array.isArray(verification.driver_photos) 
    ? verification.driver_photos 
    : JSON.parse(verification.driver_photos || '[]');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pickup Verification</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Timer Alert */}
          <View style={styles.timerCard}>
            <MaterialIcons name="access-time" size={32} color={Colors.warning} />
            <View style={styles.timerContent}>
              <Text style={styles.timerTitle}>Action Required</Text>
              <Text style={styles.timerText}>
                The driver has noted minor differences. Please review the photos and respond within:
              </Text>
              <Text style={styles.timerCountdown}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.timerSubtext}>
                If no response is received, the verification will be automatically approved
              </Text>
            </View>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialIcons name="warning" size={24} color={Colors.warning} />
              <Text style={styles.statusTitle}>Minor Differences Found</Text>
            </View>
            {verification.differences_description && (
              <Text style={styles.statusDescription}>
                {verification.differences_description}
              </Text>
            )}
          </View>

          {/* Photos Grid */}
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Verification Photos ({photos.length})</Text>
            <View style={styles.photosGrid}>
              {photos.map((photo: any, index: number) => (
                <View key={index} style={styles.photoCard}>
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoLabel}>
                    <Text style={styles.photoLabelText}>
                      {photo.angle?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Comparison Notes */}
          {verification.comparison_notes && Object.keys(verification.comparison_notes).length > 0 && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Driver's Notes</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>
                  {typeof verification.comparison_notes === 'string'
                    ? verification.comparison_notes
                    : JSON.stringify(verification.comparison_notes, null, 2)}
                </Text>
              </View>
            </View>
          )}

          {/* Refund Information */}
          <View style={styles.refundCard}>
            <Text style={styles.refundTitle}>💰 Refund Information</Text>
            <View style={styles.refundRow}>
              <Text style={styles.refundLabel}>If you approve:</Text>
              <Text style={styles.refundValue}>Shipment proceeds as planned</Text>
            </View>
            <View style={styles.refundRow}>
              <Text style={styles.refundLabel}>If you dispute:</Text>
              <Text style={styles.refundValue}>100% refund + shipment cancellation</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.disputeButton]}
            onPress={handleDispute}
            disabled={responding}
          >
            {responding ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialIcons name="close" size={20} color="white" />
                <Text style={styles.buttonText}>Dispute & Cancel</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() => handleApprove(false)}
            disabled={responding}
          >
            {responding ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="white" />
                <Text style={styles.buttonText}>Approve & Continue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 16,
  },
  timerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.warning + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  timerContent: {
    flex: 1,
    marginLeft: 12,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  timerCountdown: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.warning,
    textAlign: 'center',
    marginVertical: 8,
  },
  timerSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  statusDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginTop: 8,
  },
  photosSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  photoCard: {
    width: '50%',
    padding: 4,
  },
  photoImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  photoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 4,
  },
  photoLabelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesCard: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  refundCard: {
    backgroundColor: Colors.success + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  refundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  refundLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  refundValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  disputeButton: {
    backgroundColor: Colors.error,
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
