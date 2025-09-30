import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

interface SupportTicket {
  subject: string;
  description: string;
  category: string;
  priority: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: "How do I start accepting job requests?",
    answer: "Toggle your availability switch in your driver profile to 'Available for Jobs'. Make sure your location services are enabled and you've completed your vehicle information.",
    category: "Getting Started"
  },
  {
    id: 2,
    question: "How are my earnings calculated?",
    answer: "You earn 90% of the delivery fee charged to customers. This includes the base rate plus any distance and time charges. Earnings are deposited to your account weekly.",
    category: "Earnings"
  },
  {
    id: 3,
    question: "What if I can't find the pickup location?",
    answer: "Use the 'View Route' feature to get directions. If you still can't locate it, contact the customer through the messaging system or call our support line.",
    category: "Deliveries"
  },
  {
    id: 4,
    question: "How do I update my vehicle information?",
    answer: "Go to your driver profile and select 'Vehicle Information'. Update your vehicle details, insurance, and registration information. Keep documents current to avoid account suspension.",
    category: "Account"
  },
  {
    id: 5,
    question: "What should I do if there's an accident?",
    answer: "1. Ensure everyone's safety\n2. Call emergency services if needed\n3. Document the scene with photos\n4. Contact DriveDrop support immediately\n5. File a report with your insurance company",
    category: "Safety"
  },
  {
    id: 6,
    question: "How do I report inappropriate customer behavior?",
    answer: "If you experience harassment or feel unsafe, end the delivery and report it immediately through the app or by calling our support line. Your safety is our priority.",
    category: "Safety"
  },
  {
    id: 7,
    question: "Why was my account suspended?",
    answer: "Accounts may be suspended for incomplete documentation, customer complaints, safety violations, or terms of service violations. Contact support for details and reinstatement procedures.",
    category: "Account"
  },
  {
    id: 8,
    question: "How do I change my preferred delivery radius?",
    answer: "In your driver profile settings, adjust the 'Preferred Job Radius' field. This determines how far from your location you'll receive job offers.",
    category: "Settings"
  }
];

const SUPPORT_CATEGORIES = [
  'Account Issues',
  'Payment & Earnings',
  'Technical Problems',
  'Vehicle & Documents',
  'Safety Concerns',
  'General Inquiry'
];

const PRIORITY_LEVELS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' }
];

export default function HelpSupportScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket>({
    subject: '',
    description: '',
    category: 'General Inquiry',
    priority: 'medium'
  });

  const handleCallSupport = () => {
    const phoneNumber = '+1-800-DRIVEDROP'; // Replace with actual support number
    Alert.alert(
      'Call Support',
      `Call our support team at ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => Linking.openURL(`tel:${phoneNumber.replace(/[^0-9+]/g, '')}`)
        }
      ]
    );
  };

  const handleEmailSupport = () => {
    const email = 'support@drivedrop.com';
    const subject = 'Driver Support Request';
    const body = `Driver ID: ${userProfile?.id}\nName: ${userProfile?.first_name} ${userProfile?.last_name}\n\nPlease describe your issue:\n`;
    
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleWhatsAppSupport = () => {
    const phoneNumber = '+1234567890'; // Replace with actual WhatsApp number
    const message = `Hi, I need help with my DriveDrop driver account. Driver ID: ${userProfile?.id}`;
    
    Linking.openURL(`whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`);
  };

  const submitSupportTicket = async () => {
    if (!userProfile) return;
    
    if (!ticket.subject.trim() || !ticket.description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await (supabase as any)
        .from('support_tickets')
        .insert({
          user_id: userProfile.id,
          subject: ticket.subject.trim(),
          description: ticket.description.trim(),
          category: ticket.category,
          priority: ticket.priority,
          status: 'open',
          created_at: new Date().toISOString()
        });

      if (error) {
        // If table doesn't exist, fall back to email
        if (error.code === '42P01') {
          handleEmailSupport();
          setShowContactModal(false);
          return;
        }
        throw error;
      }

      Alert.alert(
        'Ticket Submitted',
        'Your support request has been submitted. We\'ll get back to you within 24 hours.',
        [{ text: 'OK', onPress: () => setShowContactModal(false) }]
      );

      // Reset form
      setTicket({
        subject: '',
        description: '',
        category: 'General Inquiry',
        priority: 'medium'
      });

    } catch (error) {
      console.error('Error submitting support ticket:', error);
      Alert.alert('Error', 'Failed to submit your request. Please try again or contact us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const groupedFAQs = FAQ_DATA.reduce((groups, faq) => {
    const category = faq.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(faq);
    return groups;
  }, {} as Record<string, FAQItem[]>);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Immediate Help?</Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCallSupport}>
              <MaterialIcons name="phone" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Call Support</Text>
              <Text style={styles.actionSubtext}>24/7 Emergency Line</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppSupport}>
              <MaterialIcons name="chat" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>WhatsApp</Text>
              <Text style={styles.actionSubtext}>Quick Chat Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setShowContactModal(true)}>
              <MaterialIcons name="support" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Submit Ticket</Text>
              <Text style={styles.actionSubtext}>Detailed Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyHeader}>
            <MaterialIcons name="warning" size={20} color={Colors.error} />
            <Text style={styles.emergencyTitle}>Emergency Contacts</Text>
          </View>
          <Text style={styles.emergencyText}>
            For accidents or safety emergencies: Call 911 first, then contact DriveDrop support
          </Text>
          <TouchableOpacity style={styles.emergencyButton} onPress={() => Linking.openURL('tel:911')}>
            <MaterialIcons name="local-hospital" size={16} color={Colors.text.inverse} />
            <Text style={styles.emergencyButtonText}>Call 911</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {Object.entries(groupedFAQs).map(([category, faqs]) => (
            <View key={category} style={styles.faqCategory}>
              <Text style={styles.categoryTitle}>{category}</Text>
              
              {faqs.map((faq) => (
                <View key={faq.id} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(faq.id)}
                  >
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    <MaterialIcons
                      name={expandedFAQ === faq.id ? "expand-less" : "expand-more"}
                      size={24}
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                  
                  {expandedFAQ === faq.id && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Additional Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Resources</Text>
          
          <TouchableOpacity style={styles.resourceItem} onPress={handleEmailSupport}>
            <MaterialIcons name="email" size={20} color={Colors.primary} />
            <Text style={styles.resourceText}>Email Support</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resourceItem}
            onPress={() => Linking.openURL('https://drivedrop.com/driver-guide')}
          >
            <MaterialIcons name="book" size={20} color={Colors.primary} />
            <Text style={styles.resourceText}>Driver Handbook</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resourceItem}
            onPress={() => Linking.openURL('https://drivedrop.com/terms')}
          >
            <MaterialIcons name="description" size={20} color={Colors.primary} />
            <Text style={styles.resourceText}>Terms of Service</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Contact Support Modal */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowContactModal(false)}
            >
              <MaterialIcons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Submit Support Ticket</Text>
            <TouchableOpacity
              style={styles.modalSubmitButton}
              onPress={submitSupportTicket}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.modalSubmitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subject *</Text>
              <TextInput
                style={styles.formInput}
                value={ticket.subject}
                onChangeText={(text) => setTicket(prev => ({ ...prev, subject: text }))}
                placeholder="Brief description of your issue"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.categoryButtons}>
                {SUPPORT_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      ticket.category === category && styles.categoryButtonSelected
                    ]}
                    onPress={() => setTicket(prev => ({ ...prev, category }))}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      ticket.category === category && styles.categoryButtonTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.priorityButtons}>
                {PRIORITY_LEVELS.map((priority) => (
                  <TouchableOpacity
                    key={priority.value}
                    style={[
                      styles.priorityButton,
                      ticket.priority === priority.value && styles.priorityButtonSelected
                    ]}
                    onPress={() => setTicket(prev => ({ ...prev, priority: priority.value }))}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      ticket.priority === priority.value && styles.priorityButtonTextSelected
                    ]}>
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={ticket.description}
                onChangeText={(text) => setTicket(prev => ({ ...prev, description: text }))}
                placeholder="Please provide detailed information about your issue..."
                placeholderTextColor={Colors.text.disabled}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  actionSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  emergencySection: {
    backgroundColor: Colors.error + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 12,
    lineHeight: 20,
  },
  emergencyButton: {
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  emergencyButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    marginLeft: 8,
  },
  faqCategory: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  faqItem: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  faqAnswerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  resourceText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalSubmitButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryButtonText: {
    fontSize: 12,
    color: Colors.text.primary,
  },
  categoryButtonTextSelected: {
    color: Colors.text.inverse,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  priorityButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  priorityButtonText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  priorityButtonTextSelected: {
    color: Colors.text.inverse,
  },
});