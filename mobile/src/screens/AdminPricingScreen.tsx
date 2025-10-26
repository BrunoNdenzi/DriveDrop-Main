import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../utils/environment';
import { supabase } from '../lib/supabase';

interface PricingConfig {
  id: string;
  min_quote: number;
  accident_min_quote: number;
  min_miles: number;
  base_fuel_price: number;
  current_fuel_price: number;
  fuel_adjustment_per_dollar: number;
  surge_multiplier: number;
  surge_enabled: boolean;
  expedited_multiplier: number;
  flexible_multiplier: number;
  standard_multiplier: number;
  short_distance_max: number;
  mid_distance_max: number;
  expedited_service_enabled: boolean;
  flexible_service_enabled: boolean;
  bulk_discount_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminPricingScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [editedConfig, setEditedConfig] = useState<Partial<PricingConfig>>({});
  const [changeReason, setChangeReason] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    minimums: true,
    fuel: true,
    surge: false,
    delivery: false,
    distance: false,
    services: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        throw new Error('User not authenticated');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/admin/pricing/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data);
        setEditedConfig({});
      } else {
        throw new Error(data.error?.message || 'Failed to load configuration');
      }
    } catch (error: any) {
      console.error('Failed to load pricing config:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to load pricing configuration'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConfig();
    setRefreshing(false);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateField = (field: keyof PricingConfig, value: any) => {
    setEditedConfig(prev => ({ ...prev, [field]: value }));
  };

  const getValue = (field: keyof PricingConfig): any => {
    const value = field in editedConfig ? editedConfig[field] : config?.[field];
    return value;
  };

  const getNumberValue = (field: keyof PricingConfig): number => {
    const value = getValue(field);
    return typeof value === 'number' ? value : 0;
  };

  const getBooleanValue = (field: keyof PricingConfig): boolean => {
    const value = getValue(field);
    return typeof value === 'boolean' ? value : false;
  };

  const hasChanges = () => {
    return Object.keys(editedConfig).length > 0;
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      Alert.alert('No Changes', 'No changes to save');
      return;
    }

    if (!changeReason.trim()) {
      Alert.alert('Change Reason Required', 'Please provide a reason for this change');
      return;
    }

    try {
      setSaving(true);
      
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        throw new Error('User not authenticated');
      }

      const payload = {
        ...editedConfig,
        change_reason: changeReason,
      };

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/admin/pricing/config/${config?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Pricing configuration updated successfully');
        setConfig(data.data);
        setEditedConfig({});
        setChangeReason('');
      } else {
        throw new Error(data.error?.message || 'Failed to update configuration');
      }
    } catch (error: any) {
      console.error('Failed to update pricing config:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update pricing configuration'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Changes',
      'Are you sure you want to discard all changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            setEditedConfig({});
            setChangeReason('');
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading pricing configuration...</Text>
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#999" />
        <Text style={styles.errorText}>Failed to load configuration</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadConfig}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Info */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Dynamic Pricing Configuration</Text>
          <Text style={styles.headerSubtitle}>
            Last updated: {new Date(config.updated_at).toLocaleDateString()}
          </Text>
          {hasChanges() && (
            <View style={styles.changesIndicator}>
              <Ionicons name="warning" size={16} color="#FF9500" />
              <Text style={styles.changesText}>Unsaved changes</Text>
            </View>
          )}
        </View>

        {/* Minimum Quotes Section */}
        <ConfigSection
          title="Minimum Quotes"
          icon="cash"
          expanded={expandedSections.minimums}
          onToggle={() => toggleSection('minimums')}
        >
          <NumberInput
            label="Minimum Quote"
            value={getNumberValue('min_quote')}
            onChange={(value) => updateField('min_quote', value)}
            prefix="$"
            helperText="Minimum price for trips under minimum miles"
          />
          <NumberInput
            label="Accident Recovery Minimum"
            value={getNumberValue('accident_min_quote')}
            onChange={(value) => updateField('accident_min_quote', value)}
            prefix="$"
            helperText="Special minimum for accident recovery jobs"
          />
          <NumberInput
            label="Minimum Miles Threshold"
            value={getNumberValue('min_miles')}
            onChange={(value) => updateField('min_miles', value)}
            suffix="mi"
            helperText="Distance below which minimum quote applies"
          />
        </ConfigSection>

        {/* Fuel Pricing Section */}
        <ConfigSection
          title="Fuel Pricing"
          icon="flame"
          expanded={expandedSections.fuel}
          onToggle={() => toggleSection('fuel')}
        >
          <NumberInput
            label="Base Fuel Price"
            value={getNumberValue('base_fuel_price')}
            onChange={(value) => updateField('base_fuel_price', value)}
            prefix="$"
            suffix="/gal"
            helperText="Baseline fuel price for calculations"
            step={0.01}
          />
          <NumberInput
            label="Current Fuel Price"
            value={getNumberValue('current_fuel_price')}
            onChange={(value) => updateField('current_fuel_price', value)}
            prefix="$"
            suffix="/gal"
            helperText="Current market fuel price (update frequently)"
            step={0.01}
            highlighted
          />
          <NumberInput
            label="Fuel Adjustment Factor"
            value={getNumberValue('fuel_adjustment_per_dollar')}
            onChange={(value) => updateField('fuel_adjustment_per_dollar', value)}
            helperText="Price adjustment per dollar of fuel price change"
            step={0.1}
          />
        </ConfigSection>

        {/* Surge Pricing Section */}
        <ConfigSection
          title="Surge Pricing"
          icon="trending-up"
          expanded={expandedSections.surge}
          onToggle={() => toggleSection('surge')}
        >
          <SwitchInput
            label="Enable Surge Pricing"
            value={getBooleanValue('surge_enabled')}
            onChange={(value) => updateField('surge_enabled', value)}
            helperText="Turn on demand-based surge pricing"
          />
          <NumberInput
            label="Surge Multiplier"
            value={getNumberValue('surge_multiplier')}
            onChange={(value) => updateField('surge_multiplier', value)}
            suffix="x"
            helperText="Price multiplier when surge is active (1.0 = no surge)"
            step={0.05}
            min={1.0}
            max={3.0}
            disabled={!getBooleanValue('surge_enabled')}
          />
        </ConfigSection>

        {/* Delivery Type Multipliers Section */}
        <ConfigSection
          title="Delivery Type Pricing"
          icon="time"
          expanded={expandedSections.delivery}
          onToggle={() => toggleSection('delivery')}
        >
          <NumberInput
            label="Expedited Multiplier"
            value={getNumberValue('expedited_multiplier')}
            onChange={(value) => updateField('expedited_multiplier', value)}
            suffix="x"
            helperText="Premium for rush/expedited delivery"
            step={0.05}
          />
          <NumberInput
            label="Standard Multiplier"
            value={getNumberValue('standard_multiplier')}
            onChange={(value) => updateField('standard_multiplier', value)}
            suffix="x"
            helperText="Base multiplier for standard delivery"
            step={0.05}
          />
          <NumberInput
            label="Flexible Multiplier"
            value={getNumberValue('flexible_multiplier')}
            onChange={(value) => updateField('flexible_multiplier', value)}
            suffix="x"
            helperText="Discount for flexible delivery schedules"
            step={0.05}
          />
        </ConfigSection>

        {/* Distance Bands Section */}
        <ConfigSection
          title="Distance Bands"
          icon="map"
          expanded={expandedSections.distance}
          onToggle={() => toggleSection('distance')}
        >
          <NumberInput
            label="Short Distance Max"
            value={getNumberValue('short_distance_max')}
            onChange={(value) => updateField('short_distance_max', value)}
            suffix="mi"
            helperText="Maximum miles for short distance pricing"
          />
          <NumberInput
            label="Mid Distance Max"
            value={getNumberValue('mid_distance_max')}
            onChange={(value) => updateField('mid_distance_max', value)}
            suffix="mi"
            helperText="Maximum miles for mid distance pricing"
          />
          <Text style={styles.infoText}>
            Long distance: Above {getNumberValue('mid_distance_max')} miles
          </Text>
        </ConfigSection>

        {/* Service Toggles Section */}
        <ConfigSection
          title="Service Availability"
          icon="checkmark-circle"
          expanded={expandedSections.services}
          onToggle={() => toggleSection('services')}
        >
          <SwitchInput
            label="Expedited Service"
            value={getBooleanValue('expedited_service_enabled')}
            onChange={(value) => updateField('expedited_service_enabled', value)}
            helperText="Allow customers to book expedited delivery"
          />
          <SwitchInput
            label="Flexible Service"
            value={getBooleanValue('flexible_service_enabled')}
            onChange={(value) => updateField('flexible_service_enabled', value)}
            helperText="Allow customers to book flexible delivery"
          />
          <SwitchInput
            label="Bulk Discounts"
            value={getBooleanValue('bulk_discount_enabled')}
            onChange={(value) => updateField('bulk_discount_enabled', value)}
            helperText="Enable automatic bulk shipment discounts"
          />
        </ConfigSection>

        {/* Change Reason Input */}
        {hasChanges() && (
          <View style={styles.changeReasonContainer}>
            <Text style={styles.changeReasonLabel}>Change Reason *</Text>
            <TextInput
              style={styles.changeReasonInput}
              value={changeReason}
              onChangeText={setChangeReason}
              placeholder="Describe why these changes are being made..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.changeReasonHelper}>
              Required for audit trail
            </Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      {hasChanges() && (
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.resetButton]} 
            onPress={handleReset}
            disabled={saving}
          >
            <Ionicons name="close-circle" size={20} color="#FF3B30" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]} 
            onPress={handleSave}
            disabled={saving || !changeReason.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Reusable Components

interface ConfigSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ConfigSection({ title, icon, expanded, onToggle, children }: ConfigSectionProps) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={24} color="#007AFF" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color="#999" 
        />
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  helperText?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  highlighted?: boolean;
}

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  helperText,
  step = 1,
  min,
  max,
  disabled = false,
  highlighted = false,
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  useEffect(() => {
    setInputValue(value?.toString() || '');
  }, [value]);

  const handleBlur = () => {
    let numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setInputValue(value?.toString() || '');
      return;
    }
    
    if (min !== undefined && numValue < min) numValue = min;
    if (max !== undefined && numValue > max) numValue = max;
    
    onChange(numValue);
    setInputValue(numValue.toString());
  };

  return (
    <View style={[styles.inputGroup, highlighted && styles.inputGroupHighlighted]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.numberInput, disabled && styles.inputDisabled]}
          value={inputValue}
          onChangeText={setInputValue}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          editable={!disabled}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
      {helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

interface SwitchInputProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  helperText?: string;
}

function SwitchInput({ label, value, onChange, helperText }: SwitchInputProps) {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.inputLabel}>{label}</Text>
          {helperText && <Text style={styles.helperText}>{helperText}</Text>}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: '#E0E0E0', true: '#34C759' }}
          thumbColor="#FFF"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  changesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
  },
  changesText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupHighlighted: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    flex: 1,
    fontSize: 18,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputDisabled: {
    backgroundColor: '#F0F0F0',
    color: '#999',
  },
  inputPrefix: {
    fontSize: 18,
    color: '#666',
    marginRight: 8,
    fontWeight: '600',
  },
  inputSuffix: {
    fontSize: 18,
    color: '#666',
    marginLeft: 8,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 8,
  },
  changeReasonContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  changeReasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  changeReasonInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 80,
  },
  changeReasonHelper: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  resetButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  resetButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
