import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';

interface Props {
  shipmentData: any;
  accepted: boolean;
  onAcceptanceUpdate: (accepted: boolean) => void;
}

const TERMS_CONTENT = {
  sections: [
    {
      title: "Vehicle Transport Service Agreement",
      content: [
        "By accepting these terms, you agree to the vehicle transport service provided by DriveDrop and acknowledge that you have read and understood all terms and conditions.",
        "This agreement is between you (the customer) and DriveDrop for the transportation of your vehicle as specified in your shipment details."
      ]
    },
    {
      title: "Vehicle Condition and Inspection",
      content: [
        "Pre-transport inspection photos will be taken to document the current condition of your vehicle.",
        "Any existing damage must be noted and photographed before transport begins.",
        "You are responsible for ensuring the vehicle is in operable condition unless specifically arranged otherwise.",
        "Personal items left in the vehicle are not covered under our insurance and transport at your own risk."
      ]
    },
    {
      title: "Liability and Insurance",
      content: [
        "DriveDrop maintains comprehensive auto transport insurance covering damage that occurs during transport.",
        "Our insurance coverage includes up to $1,000,000 in liability protection.",
        "Pre-existing damage documented in photos is not covered under our insurance policy.",
        "Claims must be reported within 48 hours of delivery with supporting documentation."
      ]
    },
    {
      title: "Payment Terms",
      content: [
        "A 20% deposit is required at booking to secure your shipment and confirm the service.",
        "The remaining 80% will be locked (pre-authorized) in your account at the time of booking and will be automatically charged upon successful delivery of your vehicle.",
        "The locked funds ensure secure payment for the driver while protecting your interests during transport.",
        "All prices are quoted in US dollars and include standard transport insurance.",
        "Additional fees may apply for expedited service, oversized vehicles, or special handling requirements.",
        "Refunds for the locked 80% are subject to our cancellation policy and delivery confirmation.",
        "If delivery is not completed as agreed, the locked funds will be released back to your account within 5-7 business days."
      ]
    },
    {
      title: "Delivery and Timing",
      content: [
        "Delivery dates are estimates and may vary due to weather, traffic, mechanical issues, or other unforeseen circumstances.",
        "You will be contacted 24-48 hours before delivery to arrange a convenient time and location.",
        "A responsible party must be present at both pickup and delivery locations.",
        "Additional charges may apply for delivery delays caused by customer unavailability."
      ]
    },
    {
      title: "Customer Responsibilities",
      content: [
        "Provide accurate vehicle information including make, model, year, and any modifications.",
        "Ensure vehicle has no more than 1/4 tank of fuel at pickup.",
        "Remove all personal items and disable any alarm systems.",
        "Provide clear access to pickup and delivery locations for transport vehicles.",
        "Have all required documentation ready including title, registration, and identification."
      ]
    },
    {
      title: "Cancellation Policy",
      content: [
        "Cancellations made more than 48 hours before scheduled pickup: Full refund minus processing fees.",
        "Cancellations made 24-48 hours before pickup: 50% refund of total amount paid.",
        "Cancellations made less than 24 hours before pickup: No refund.",
        "DriveDrop reserves the right to cancel service due to unsafe conditions or customer non-compliance."
      ]
    },
    {
      title: "Privacy and Data Protection",
      content: [
        "Your personal information is protected under our privacy policy and will not be shared with third parties without consent.",
        "Vehicle photos and documentation are stored securely and used only for transport and insurance purposes.",
        "You consent to receiving communications regarding your shipment via phone, email, or SMS.",
        "Data retention follows industry standards and legal requirements."
      ]
    }
  ]
};

const TermsAndConditionsStep: React.FC<Props> = ({ shipmentData, accepted, onAcceptanceUpdate }) => {
  const [expandedSections, setExpandedSections] = useState<number[]>([]);

  const toggleSection = (index: number) => {
    setExpandedSections(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const expandAllSections = () => {
    setExpandedSections(TERMS_CONTENT.sections.map((_, index) => index));
  };

  const collapseAllSections = () => {
    setExpandedSections([]);
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://drivedrop.com/privacy-policy').catch(() => {
      Alert.alert('Error', 'Unable to open privacy policy. Please visit our website.');
    });
  };

  const openFullTerms = () => {
    Linking.openURL('https://drivedrop.com/terms-of-service').catch(() => {
      Alert.alert('Error', 'Unable to open full terms. Please visit our website.');
    });
  };

  const handleAcceptance = () => {
    if (!accepted) {
      Alert.alert(
        'Accept Terms and Conditions',
        'By accepting these terms, you agree to all conditions outlined above and confirm that you have read and understood them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'I Accept', 
            onPress: () => onAcceptanceUpdate(true),
            style: 'default'
          }
        ]
      );
    } else {
      onAcceptanceUpdate(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <Text style={styles.headerSubtitle}>
          Please review and accept our terms to proceed with your shipment
        </Text>
      </View>

      {/* Shipment Summary */}
      <View style={styles.shipmentSummary}>
        <Text style={styles.summaryTitle}>Shipment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Vehicle:</Text>
          <Text style={styles.summaryValue}>
            {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>From:</Text>
          <Text style={styles.summaryValue}>{shipmentData.pickupAddress}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>To:</Text>
          <Text style={styles.summaryValue}>{shipmentData.deliveryAddress}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated Cost:</Text>
          <Text style={styles.summaryValue}>${shipmentData.estimatedPrice?.toFixed(2)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          onPress={expandAllSections} 
          style={styles.controlButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="unfold-more" size={20} color="#FFFFFF" />
          <Text style={styles.controlButtonText}>Expand All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={collapseAllSections} 
          style={styles.controlButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="unfold-less" size={20} color="#FFFFFF" />
          <Text style={styles.controlButtonText}>Collapse All</Text>
        </TouchableOpacity>
      </View>

      {/* Terms Content */}
      <View style={styles.termsContent}>
        {TERMS_CONTENT.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => toggleSection(index)}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <MaterialIcons 
                name={expandedSections.includes(index) ? "expand-less" : "expand-more"} 
                size={24} 
                color={Colors.primary} 
              />
            </TouchableOpacity>
            
            {expandedSections.includes(index) && (
              <View style={styles.sectionContent}>
                {section.content.map((paragraph, paragraphIndex) => (
                  <Text key={paragraphIndex} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Additional Legal Links */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={openFullTerms} style={styles.linkButton}>
            <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>View Full Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openPrivacyPolicy} style={styles.linkButton}>
            <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Important Notice */}
        <View style={styles.importantNotice}>
          <MaterialIcons name="info" size={20} color="#FF9800" />
          <Text style={styles.noticeText}>
            These terms constitute a legally binding agreement. By accepting, you agree to resolve any disputes through arbitration and waive the right to a jury trial.
          </Text>
        </View>
      </View>

      {/* Acceptance Section */}
      <View style={styles.acceptanceSection}>
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={handleAcceptance}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <MaterialIcons name="check" size={16} color="white" />}
          </View>
          <Text style={styles.acceptanceText}>
            I have read, understood, and agree to the Terms and Conditions outlined above
          </Text>
        </TouchableOpacity>

        {accepted && (
          <View style={styles.acceptedIndicator}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.acceptedText}>Terms accepted successfully</Text>
          </View>
        )}

        <Text style={styles.disclaimerText}>
          By checking this box, you electronically sign this agreement and acknowledge receipt of a copy.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  shipmentSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  controlButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '600',
  },
  termsContent: {
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  paragraph: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 12,
  },
  legalLinks: {
    marginVertical: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
    textDecorationLine: 'underline',
  },
  importantNotice: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    marginLeft: 8,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  acceptanceSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  acceptanceText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    fontWeight: '500',
  },
  acceptedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  acceptedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

export default TermsAndConditionsStep;
