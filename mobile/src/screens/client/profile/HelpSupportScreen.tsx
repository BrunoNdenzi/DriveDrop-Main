import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

const FAQ_DATA = [
  {
    id: '1',
    question: 'How do I book a shipment?',
    answer: 'To book a shipment, tap the "New Shipment" button on your home screen, enter the pickup and delivery details, and submit your request. You\'ll receive quotes from available drivers.',
  },
  {
    id: '2',
    question: 'How are shipping rates calculated?',
    answer: 'Shipping rates depend on distance, package size, weight, urgency, and driver availability. Each driver sets their own rates based on these factors.',
  },
  {
    id: '3',
    question: 'What payment methods are accepted?',
    answer: 'We accept major credit cards, debit cards, and bank transfers. You can manage your payment methods in your profile settings.',
  },
  {
    id: '4',
    question: 'Can I track my shipment in real-time?',
    answer: 'Yes! Once your shipment is picked up, you can track its location in real-time through the app. You\'ll also receive notifications about status updates.',
  },
  {
    id: '5',
    question: 'What if my package is damaged or lost?',
    answer: 'All shipments are covered by our protection policy. If your package is damaged or lost, contact support immediately to file a claim.',
  },
  {
    id: '6',
    question: 'How do I cancel a shipment?',
    answer: 'You can cancel a shipment before it\'s picked up by going to your shipments list and selecting "Cancel". Cancellation fees may apply depending on timing.',
  },
];

const SUPPORT_CATEGORIES = [
  { id: 'account', label: 'Account Issues', icon: 'person-circle-outline' },
  { id: 'payment', label: 'Payment & Billing', icon: 'card-outline' },
  { id: 'shipping', label: 'Shipping Questions', icon: 'cube-outline' },
  { id: 'technical', label: 'Technical Support', icon: 'bug-outline' },
  { id: 'general', label: 'General Inquiry', icon: 'help-circle-outline' },
  { id: 'billing', label: 'Billing Dispute', icon: 'receipt-outline' },
];

export default function HelpSupportScreen({ navigation }: any) {
  const { user } = useAuth();
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('support_tickets')
        .insert([
          {
            user_id: user?.id,
            subject: subject.trim(),
            description: description.trim(),
            category: selectedCategory,
            priority: 'medium',
            status: 'open',
          },
        ]);

      if (error) throw error;

      Alert.alert(
        'Ticket Submitted',
        'Your support ticket has been submitted. We\'ll get back to you within 24 hours.',
        [{ text: 'OK', onPress: () => setShowContactModal(false) }]
      );

      setSubject('');
      setDescription('');
      setSelectedCategory('general');
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      Alert.alert('Error', 'Failed to submit support ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const QuickActionButton = ({
    icon,
    title,
    subtitle,
    onPress,
    color = '#007AFF',
  }: {
    icon: string;
    title: string;
    subtitle: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <Ionicons name={icon as any} size={32} color={color} />
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const FAQItem = ({ item }: { item: typeof FAQ_DATA[0] }) => {
    const isExpanded = expandedFAQ === item.id;
    
    return (
      <TouchableOpacity
        style={styles.faqItem}
        onPress={() => setExpandedFAQ(isExpanded ? null : item.id)}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{item.question}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </View>
        {isExpanded && (
          <Text style={styles.faqAnswer}>{item.answer}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Help</Text>
          
          <QuickActionButton
            icon="chatbubble-ellipses"
            title="Contact Support"
            subtitle="Get help from our support team"
            onPress={() => setShowContactModal(true)}
            color="#007AFF"
          />
          
          <QuickActionButton
            icon="call"
            title="Call Support"
            subtitle="Speak with a support representative"
            onPress={() => openLink('tel:+1-800-DRIVEDROP')}
            color="#28a745"
          />
          
          <QuickActionButton
            icon="mail"
            title="Email Support"
            subtitle="Send us an email"
            onPress={() => openLink('mailto:support@drivedrop.com')}
            color="#dc3545"
          />
        </View>

        {/* Frequently Asked Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {FAQ_DATA.map((item) => (
            <FAQItem key={item.id} item={item} />
          ))}
        </View>

        {/* Additional Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Resources</Text>
          
          <TouchableOpacity
            style={styles.resourceButton}
            onPress={() => openLink('https://drivedrop.com/terms')}
          >
            <Ionicons name="document-text" size={24} color="#007AFF" />
            <Text style={styles.resourceText}>Terms of Service</Text>
            <Ionicons name="open-outline" size={20} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.resourceButton}
            onPress={() => openLink('https://drivedrop.com/privacy')}
          >
            <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
            <Text style={styles.resourceText}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={20} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.resourceButton}
            onPress={() => openLink('https://drivedrop.com/safety')}
          >
            <Ionicons name="shield" size={24} color="#007AFF" />
            <Text style={styles.resourceText}>Safety Guidelines</Text>
            <Ionicons name="open-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoTitle}>DriveDrop</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
          <Text style={styles.appInfoText}>
            Need more help? Our support team is available 24/7 to assist you.
          </Text>
        </View>
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
              onPress={() => setShowContactModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Contact Support</Text>
            <TouchableOpacity
              onPress={submitTicket}
              style={styles.modalButton}
              disabled={submitting}
            >
              <Text style={[styles.modalButtonText, styles.submitButton]}>
                {submitting ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {SUPPORT_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.id && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Ionicons
                      name={category.icon as any}
                      size={20}
                      color={selectedCategory === category.id ? '#fff' : '#007AFF'}
                    />
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === category.id && styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief description of your issue"
                maxLength={100}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Please provide detailed information about your issue"
                multiline
                numberOfLines={6}
                maxLength={1000}
              />
              <Text style={styles.characterCount}>
                {description.length}/1000 characters
              </Text>
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
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    flex: 1,
    marginLeft: 16,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  resourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resourceText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
  appInfo: {
    alignItems: 'center',
    padding: 32,
    marginTop: 24,
  },
  appInfoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  appInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalButton: {
    minWidth: 80,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  submitButton: {
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
});