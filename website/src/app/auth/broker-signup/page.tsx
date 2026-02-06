'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import type { CreateBrokerProfile, BusinessStructure } from '@/types/broker';

export default function BrokerSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getSignupErrorMessage = (message?: string) => {
    if (!message) return 'Failed to create broker account';
    const normalized = message.toLowerCase();
    if (normalized.includes('error sending email') || normalized.includes('confirmation email')) {
      return 'Failed to send the email, please contact support';
    }
    return message;
  };

  // Form data
  const [formData, setFormData] = useState({
    // User credentials
    email: '',
    password: '',
    full_name: '',
    phone: '',
    
    // Company information
    company_name: '',
    dba_name: '',
    company_email: '',
    company_phone: '',
    
    // Legal & Compliance
    dot_number: '',
    mc_number: '',
    tax_id: '',
    
    // Business details
    business_structure: '' as BusinessStructure | '',
    years_in_business: '',
    website_url: '',
    
    // Address
    business_address: '',
    business_city: '',
    business_state: '',
    business_zip: '',
    
    // Commission
    default_commission_rate: '25',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep1 = () => {
    if (!formData.email || !formData.password || !formData.full_name || !formData.phone) {
      setError('Please fill in all required fields');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.company_name || !formData.company_email || !formData.company_phone) {
      setError('Please fill in all company details');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.business_address || !formData.business_city || !formData.business_state || !formData.business_zip) {
      setError('Please fill in all address fields');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const brokerProfile: Omit<CreateBrokerProfile, 'profile_id'> = {
        company_name: formData.company_name,
        dba_name: formData.dba_name || undefined,
        company_email: formData.company_email,
        company_phone: formData.company_phone,
        dot_number: formData.dot_number || undefined,
        mc_number: formData.mc_number || undefined,
        tax_id: formData.tax_id || undefined,
        business_structure: formData.business_structure || undefined,
        years_in_business: formData.years_in_business ? parseInt(formData.years_in_business) : undefined,
        website_url: formData.website_url || undefined,
        business_address: formData.business_address,
        business_city: formData.business_city,
        business_state: formData.business_state,
        business_zip: formData.business_zip,
        business_country: 'USA',
        default_commission_rate: parseFloat(formData.default_commission_rate),
        platform_fee_rate: 10,
      };

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.full_name.split(' ')[0] || formData.full_name,
          lastName: formData.full_name.split(' ').slice(1).join(' '),
          phone: formData.phone,
          role: 'broker',
          brokerProfile,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to create broker account');
      }

      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      router.push('/dashboard/broker?welcome=true');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(getSignupErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Broker Registration
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join DriveDrop's broker network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      s === step
                        ? 'bg-blue-600 text-white'
                        : s < step
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {s < step ? '✓' : s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-16 h-1 ${
                        s < step ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Account</span>
              <span>Company</span>
              <span>Address</span>
              <span>Review</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Account Information */}
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      minLength={6}
                      className="mt-1 block w-full pr-10 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Minimum 6 characters
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Company Information */}
            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    DBA Name (Doing Business As)
                  </label>
                  <input
                    type="text"
                    name="dba_name"
                    value={formData.dba_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Company Email *
                    </label>
                    <input
                      type="email"
                      name="company_email"
                      value={formData.company_email}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Company Phone *
                    </label>
                    <input
                      type="tel"
                      name="company_phone"
                      value={formData.company_phone}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      DOT Number
                    </label>
                    <input
                      type="text"
                      name="dot_number"
                      value={formData.dot_number}
                      onChange={handleInputChange}
                      placeholder="US DOT Number"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      MC Number
                    </label>
                    <input
                      type="text"
                      name="mc_number"
                      value={formData.mc_number}
                      onChange={handleInputChange}
                      placeholder="Motor Carrier Number"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tax ID / EIN
                  </label>
                  <input
                    type="text"
                    name="tax_id"
                    value={formData.tax_id}
                    onChange={handleInputChange}
                    placeholder="Employer Identification Number"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Business Structure
                    </label>
                    <select
                      name="business_structure"
                      value={formData.business_structure}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="sole_proprietorship">Sole Proprietorship</option>
                      <option value="llc">LLC</option>
                      <option value="corporation">Corporation</option>
                      <option value="s_corp">S Corporation</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Years in Business
                    </label>
                    <input
                      type="number"
                      name="years_in_business"
                      value={formData.years_in_business}
                      onChange={handleInputChange}
                      min="0"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Website URL
                  </label>
                  <input
                    type="url"
                    name="website_url"
                    value={formData.website_url}
                    onChange={handleInputChange}
                    placeholder="https://"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    name="default_commission_rate"
                    value={formData.default_commission_rate}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Platform fee: 10% | Remainder goes to carrier
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Business Address */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Business Address</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    name="business_address"
                    value={formData.business_address}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">
                      City *
                    </label>
                    <input
                      type="text"
                      name="business_city"
                      value={formData.business_city}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">
                      State *
                    </label>
                    <input
                      type="text"
                      name="business_state"
                      value={formData.business_state}
                      onChange={handleInputChange}
                      required
                      maxLength={2}
                      placeholder="CA"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      name="business_zip"
                      value={formData.business_zip}
                      onChange={handleInputChange}
                      required
                      placeholder="12345"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Review Your Information</h3>
                
                <div className="bg-gray-50 p-4 rounded-md space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Account</h4>
                    <p className="text-sm text-gray-600">{formData.full_name}</p>
                    <p className="text-sm text-gray-600">{formData.email}</p>
                    <p className="text-sm text-gray-600">{formData.phone}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Company</h4>
                    <p className="text-sm text-gray-600">{formData.company_name}</p>
                    {formData.dba_name && (
                      <p className="text-sm text-gray-600">DBA: {formData.dba_name}</p>
                    )}
                    <p className="text-sm text-gray-600">{formData.company_email}</p>
                    <p className="text-sm text-gray-600">{formData.company_phone}</p>
                    {formData.dot_number && (
                      <p className="text-sm text-gray-600">DOT: {formData.dot_number}</p>
                    )}
                    {formData.mc_number && (
                      <p className="text-sm text-gray-600">MC: {formData.mc_number}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Address</h4>
                    <p className="text-sm text-gray-600">{formData.business_address}</p>
                    <p className="text-sm text-gray-600">
                      {formData.business_city}, {formData.business_state} {formData.business_zip}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900">Commission</h4>
                    <p className="text-sm text-gray-600">
                      Broker: {formData.default_commission_rate}% | Platform: 10%
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Your broker account will be pending verification. 
                    An admin will review your information and may request additional documentation 
                    (insurance, DOT authority, etc.) before full approval.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-6 flex justify-between">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back
                </button>
              )}
              
              <div className="ml-auto">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Complete Registration'}
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
