'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService } from '@/services/brokerService';
import type { BrokerProfile } from '@/types/broker';
import { 
  User, 
  Building2,
  CreditCard,
  Bell,
  Shield,
  FileText,
  Mail,
  Phone,
  MapPin,
  Save,
  Check,
  AlertCircle,
  Upload,
  X,
  Eye,
  EyeOff,
  Lock,
  Clock,
  SendHorizonal
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type SettingsTab = 'profile' | 'business' | 'payment' | 'notifications' | 'security' | 'documents';

export default function BrokerSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Business fields
  const [companyName, setCompanyName] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [newLoadAlerts, setNewLoadAlerts] = useState(true);
  const [bidUpdates, setBidUpdates] = useState(true);
  const [paymentNotifications, setPaymentNotifications] = useState(true);

  // Business change request tracking
  const [originalBusinessValues, setOriginalBusinessValues] = useState({
    company_name: '',
    mc_number: '',
    dot_number: '',
    tax_id: '',
  });
  const [pendingChangeRequest, setPendingChangeRequest] = useState<{
    id: string;
    changes: Record<string, { old_value: string; new_value: string }>;
    status: string;
    created_at: string;
  } | null>(null);
  const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      // Populate fields - use available BrokerProfile fields
      setFullName(''); // Not on BrokerProfile, will need to get from profile table
      setEmail(brokerProfile.company_email || user.email || '');
      setPhone(brokerProfile.company_phone || '');
      setAddress(brokerProfile.business_address || '');
      setCompanyName(brokerProfile.company_name || '');
      setMcNumber(brokerProfile.mc_number || '');
      setDotNumber(brokerProfile.dot_number || '');
      setTaxId(brokerProfile.tax_id || '');
      setBusinessAddress(brokerProfile.business_address || '');

      // Store original critical values for change detection
      setOriginalBusinessValues({
        company_name: brokerProfile.company_name || '',
        mc_number: brokerProfile.mc_number || '',
        dot_number: brokerProfile.dot_number || '',
        tax_id: brokerProfile.tax_id || '',
      });

      // Check for pending business change requests
      try {
        const { data: pendingReq } = await supabase
          .from('broker_change_requests')
          .select('*')
          .eq('broker_id', brokerProfile.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (pendingReq) {
          setPendingChangeRequest(pendingReq);
        }
      } catch {
        // Table may not exist yet â€” ignore silently
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setErrorMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Save profile updates to broker profile
      await brokerProfileService.update(broker!.id, {
        company_phone: phone,
        business_address: address
      });

      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusiness = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const supabase = getSupabaseBrowserClient();

      // Always save non-critical field directly
      await brokerProfileService.update(broker!.id, {
        business_address: businessAddress
      });

      // Detect changes in critical fields
      const criticalChanges: Record<string, { old_value: string; new_value: string }> = {};
      if (companyName !== originalBusinessValues.company_name) {
        criticalChanges.company_name = { old_value: originalBusinessValues.company_name, new_value: companyName };
      }
      if (mcNumber !== originalBusinessValues.mc_number) {
        criticalChanges.mc_number = { old_value: originalBusinessValues.mc_number, new_value: mcNumber };
      }
      if (dotNumber !== originalBusinessValues.dot_number) {
        criticalChanges.dot_number = { old_value: originalBusinessValues.dot_number, new_value: dotNumber };
      }
      if (taxId !== originalBusinessValues.tax_id) {
        criticalChanges.tax_id = { old_value: originalBusinessValues.tax_id, new_value: taxId };
      }

      if (Object.keys(criticalChanges).length > 0) {
        // Submit change request for critical fields
        setSubmittingChangeRequest(true);

        const { data: changeReq, error: crError } = await supabase
          .from('broker_change_requests')
          .insert({
            broker_id: broker!.id,
            changes: criticalChanges,
            status: 'pending',
            reason: 'Business information update requested by broker',
          })
          .select()
          .single();

        if (crError) {
          // If table doesn't exist, fall back to direct update with notice
          console.warn('Change request table not available, saving directly:', crError);
          await brokerProfileService.update(broker!.id, {
            company_name: companyName,
            mc_number: mcNumber,
            dot_number: dotNumber,
            tax_id: taxId,
          });
          setSuccessMessage('Business information updated. Note: Critical field changes should be verified by an admin.');
        } else {
          setPendingChangeRequest(changeReq);
          // Revert critical fields to original values (pending approval)
          setCompanyName(originalBusinessValues.company_name);
          setMcNumber(originalBusinessValues.mc_number);
          setDotNumber(originalBusinessValues.dot_number);
          setTaxId(originalBusinessValues.tax_id);
          setSuccessMessage(
            'Business address saved. Critical field changes (Company Name, MC#, DOT#, Tax ID) have been submitted for admin review.'
          );
        }
        setSubmittingChangeRequest(false);
      } else {
        setSuccessMessage('Business address updated successfully');
      }

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('Error saving business info:', err);
      setErrorMessage(err.message || 'Failed to update business information');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!paymentMethod) {
        setErrorMessage('Please select a payment method');
        return;
      }

      const paymentData: Record<string, any> = { payment_method: paymentMethod };
      if (paymentMethod === 'bank_transfer') {
        if (!accountNumber || !routingNumber) {
          setErrorMessage('Bank account and routing number are required');
          return;
        }
        paymentData.bank_account_last4 = accountNumber.slice(-4);
        paymentData.routing_number_last4 = routingNumber.slice(-4);
      }

      await brokerProfileService.update(broker!.id, paymentData);
      setSuccessMessage('Payment method updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error saving payment method:', err);
      setErrorMessage(err.message || 'Failed to update payment method');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            email_notifications: emailNotifications,
            sms_notifications: smsNotifications,
            new_load_alerts: newLoadAlerts,
            bid_updates: bidUpdates,
            payment_notifications: paymentNotifications,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }

      setSuccessMessage('Notification preferences updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error saving notifications:', err);
      setErrorMessage(err.message || 'Failed to update notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'business' as SettingsTab, label: 'Business Info', icon: Building2 },
    { id: 'payment' as SettingsTab, label: 'Payment Method', icon: CreditCard },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'security' as SettingsTab, label: 'Security', icon: Shield },
    { id: 'documents' as SettingsTab, label: 'Documents', icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-gray-200 rounded-md p-4">
        <h1 className="text-lg font-semibold text-gray-900">Account Settings</h1>
        <p className="text-xs text-gray-500">
          Manage your broker profile, business details, and preferences
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Tabs Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-md border border-gray-200 p-3 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                    activeTab === tab.id
                      ? 'bg-teal-500 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Profile Information</h2>
                  <p className="text-sm text-gray-600">Update your personal information and contact details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        placeholder="john@example.com"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                        placeholder="123 Main St, City, State ZIP"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            )}

            {/* Business Tab */}
            {activeTab === 'business' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Business Information</h2>
                  <p className="text-sm text-gray-600">Update your company details and certifications</p>
                </div>

                {/* Pending Change Request Banner */}
                {pendingChangeRequest && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">Change Request Pending Review</p>
                        <p className="text-xs text-amber-700 mt-1">
                          You submitted changes to critical business fields on {new Date(pendingChangeRequest.created_at).toLocaleDateString()}.
                          These are under admin review and will be updated once approved.
                        </p>
                        <div className="mt-2 space-y-1">
                          {Object.entries(pendingChangeRequest.changes as Record<string, { old_value: string; new_value: string }>).map(([field, change]) => (
                            <div key={field} className="text-xs text-amber-700">
                              <span className="font-medium">{field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:</span>{' '}
                              <span className="line-through">{change.old_value || '(empty)'}</span>{' â†’ '}
                              <span className="font-semibold">{change.new_value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Critical Fields Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <p className="text-xs text-blue-800">
                      <strong>Company Name, MC#, DOT#, and Tax ID</strong> are regulated fields. Changes to these require admin approval to ensure compliance.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      Company Name *
                      <span title="Requires admin approval"><Lock className="h-3 w-3 text-amber-500" /></span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Your Company LLC"
                    />
                    {companyName !== originalBusinessValues.company_name && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Change will require admin approval
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      MC Number *
                      <span title="Requires admin approval"><Lock className="h-3 w-3 text-amber-500" /></span>
                    </label>
                    <input
                      type="text"
                      value={mcNumber}
                      onChange={(e) => setMcNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                      placeholder="MC123456"
                    />
                    {mcNumber !== originalBusinessValues.mc_number && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Change will require admin approval
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      DOT Number
                      <span title="Requires admin approval"><Lock className="h-3 w-3 text-amber-500" /></span>
                    </label>
                    <input
                      type="text"
                      value={dotNumber}
                      onChange={(e) => setDotNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                      placeholder="DOT123456"
                    />
                    {dotNumber !== originalBusinessValues.dot_number && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Change will require admin approval
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      Tax ID (EIN)
                      <span title="Requires admin approval"><Lock className="h-3 w-3 text-amber-500" /></span>
                    </label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                      placeholder="12-3456789"
                    />
                    {taxId !== originalBusinessValues.tax_id && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Change will require admin approval
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Address
                    </label>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                      placeholder="123 Business Ave, Suite 100, City, State ZIP"
                    />
                  </div>
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-md p-4">
                  <p className="text-sm text-teal-800">
                    <strong>Verification Status:</strong> {broker?.verification_status || 'Pending'}
                  </p>
                  {broker?.verification_status !== 'verified' && (
                    <p className="text-xs text-teal-700 mt-1">
                      Complete your business information to speed up the verification process.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-3">
                  <Button
                    onClick={handleSaveBusiness}
                    disabled={saving || submittingChangeRequest}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    {(companyName !== originalBusinessValues.company_name ||
                      mcNumber !== originalBusinessValues.mc_number ||
                      dotNumber !== originalBusinessValues.dot_number ||
                      taxId !== originalBusinessValues.tax_id) ? (
                      <>
                        <SendHorizonal className="h-4 w-4 mr-2" />
                        {submittingChangeRequest ? 'Submitting...' : 'Submit for Review'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </>
                    )}
                  </Button>
                  {(companyName !== originalBusinessValues.company_name ||
                    mcNumber !== originalBusinessValues.mc_number ||
                    dotNumber !== originalBusinessValues.dot_number ||
                    taxId !== originalBusinessValues.tax_id) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCompanyName(originalBusinessValues.company_name);
                        setMcNumber(originalBusinessValues.mc_number);
                        setDotNumber(originalBusinessValues.dot_number);
                        setTaxId(originalBusinessValues.tax_id);
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reset Changes
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Payment Method</h2>
                  <p className="text-sm text-gray-600">Configure how you receive commission payouts</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">Select payment method</option>
                      <option value="bank_transfer">Bank Transfer (ACH)</option>
                      <option value="wire">Wire Transfer</option>
                      <option value="check">Check</option>
                    </select>
                  </div>

                  {paymentMethod === 'bank_transfer' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Account Number
                        </label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Enter account number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Routing Number
                        </label>
                        <input
                          type="text"
                          value={routingNumber}
                          onChange={(e) => setRoutingNumber(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Enter routing number"
                        />
                      </div>
                    </>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> Ensure your payment information is accurate. Payouts are processed within 3-5 business days.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <Button
                    onClick={handleSavePayment}
                    disabled={saving}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Payment Method'}
                  </Button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Notification Preferences</h2>
                  <p className="text-sm text-gray-600">Choose how you want to receive updates and alerts</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Communication Channels</h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                            <p className="text-xs text-gray-500">Receive updates via email</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="h-5 w-5 text-teal-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">SMS Notifications</p>
                            <p className="text-xs text-gray-500">Receive text message alerts</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={smsNotifications}
                          onChange={(e) => setSmsNotifications(e.target.checked)}
                          className="h-5 w-5 text-teal-500 rounded"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Alert Types</h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-900">New Load Alerts</p>
                          <p className="text-xs text-gray-500">Get notified when new loads match your preferences</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={newLoadAlerts}
                          onChange={(e) => setNewLoadAlerts(e.target.checked)}
                          className="h-5 w-5 text-teal-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Bid Updates</p>
                          <p className="text-xs text-gray-500">Get notified about bid acceptances and changes</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={bidUpdates}
                          onChange={(e) => setBidUpdates(e.target.checked)}
                          className="h-5 w-5 text-teal-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Payment Notifications</p>
                          <p className="text-xs text-gray-500">Get notified about payouts and commissions</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={paymentNotifications}
                          onChange={(e) => setPaymentNotifications(e.target.checked)}
                          className="h-5 w-5 text-teal-500 rounded"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Security Settings</h2>
                  <p className="text-sm text-gray-600">Manage your password and security preferences</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Toggle current password visibility"
                          >
                            {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Toggle new password visibility"
                          >
                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Toggle confirm password visibility"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white">
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Add an extra layer of security to your account
                    </p>
                    <Button variant="outline">
                      Enable 2FA
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Business Documents</h2>
                  <p className="text-sm text-gray-600">Upload and manage required documentation</p>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Broker Authority (MC)', required: true },
                    { label: 'Insurance Certificate', required: true },
                    { label: 'W-9 Form', required: true },
                    { label: 'Business License', required: false },
                  ].map((doc, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {doc.label}
                            {doc.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">PDF, max 10MB</p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-md p-4">
                  <p className="text-sm text-teal-800">
                    <strong>Note:</strong> All required documents must be uploaded for account verification. Documents are reviewed within 1-2 business days.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
