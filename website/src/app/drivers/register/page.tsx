'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, Shield, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington D.C.' },
]

const calculateAge = (dateString: string): number => {
  const birthDate = new Date(dateString + 'T00:00:00')
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

const isDateExpired = (dateString: string): boolean => {
  const expiryDate = new Date(dateString + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return expiryDate < today
}

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

// Step 1: Minimal verification data
const verificationSchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(2, 'Last name required'),
  dateOfBirth: z.string().min(1, 'Date of birth required')
    .refine((d) => calculateAge(d) >= 21, 'Must be 21+ to drive'),
  licenseNumber: z.string().min(1, 'License number required'),
  licenseState: z.string().min(2, 'State required'),
  dotNumber: z.string().optional(),
})

// Step 3: Complete registration
const completeRegistrationSchema = z.object({
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone required').refine(isValidPhone, 'Valid phone required'),
  address: z.string().min(5, 'Address required'),
  insuranceProvider: z.string().min(1, 'Insurance provider required'),
  policyNumber: z.string().min(1, 'Policy number required'),
  policyExpiration: z.string().min(1, 'Expiration date required')
    .refine((d) => !isDateExpired(d), 'Policy expired'),
  coverageAmount: z.string().min(1, 'Coverage amount required'),
  ssn: z.string().min(4, 'SSN last 4 digits required').max(4),
})

// Step 4: Agreements
const agreementsSchema = z.object({
  insuranceConsent: z.boolean().refine((v) => v === true, 'Must confirm insurance'),
  termsAccepted: z.boolean().refine((v) => v === true, 'Must accept terms'),
  smsConsent: z.boolean().refine((v) => v === true, 'Must accept SMS updates'),
})

type VerificationData = z.infer<typeof verificationSchema>
type CompleteRegistration = z.infer<typeof completeRegistrationSchema>
type Agreements = z.infer<typeof agreementsSchema>

export default function DriverRegistrationPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({})
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [applicationId, setApplicationId] = useState('')
  const [dotPreVerified, setDotPreVerified] = useState(false)
  const [showDotConfirmation, setShowDotConfirmation] = useState(false)
  const [pendingDotResult, setPendingDotResult] = useState<any>(null)

  const totalSteps = 4
  const progress = (currentStep / totalSteps) * 100

  const handleVerification = async (data: VerificationData) => {
    setFormData({ ...formData, ...data })
    
    // If DOT number provided, verify it first (FREE and INSTANT via FMCSA SAFER)
    if (data.dotNumber && data.dotNumber.trim()) {
      setIsVerifying(true)
      try {
        const response = await fetch(`${BACKEND_URL}/drivers/verify-dot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dotNumber: data.dotNumber }),
        })
        
        const result = await response.json()
        
        if (!response.ok || !result.verified) {
          alert(`❌ DOT Verification Failed\n\n${result.error || 'DOT number not found in FMCSA database. Please check and try again.'}`)
          setIsVerifying(false)
          return
        }
        
        // Show confirmation modal instead of browser confirm
        setPendingDotResult(result)
        setShowDotConfirmation(true)
        setIsVerifying(false)
      } catch (error: any) {
        alert('Failed to verify DOT number. Please try again.')
        setIsVerifying(false)
      }
    } else {
      // No DOT number, proceed directly
      setCurrentStep(2)
    }
  }

  const handleDotConfirmYes = () => {
    setDotPreVerified(true)
    setVerificationResult({ dot: pendingDotResult })
    setShowDotConfirmation(false)
    setPendingDotResult(null)
    setCurrentStep(2)
  }

  const handleDotConfirmNo = () => {
    setShowDotConfirmation(false)
    setPendingDotResult(null)
    // User stays on Step 1 to re-enter DOT number
  }

  const handleFCRAConsent = async () => {
    setIsVerifying(true)

    try {
      const response = await fetch(`${BACKEND_URL}/drivers/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          licenseNumber: formData.licenseNumber,
          licenseState: formData.licenseState,
          dotNumber: formData.dotNumber || null,
          fcraConsentObtained: true,
          fcraConsentIpAddress: 'client-ip',
          fcraConsentSignature: `${formData.firstName} ${formData.lastName}`,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed')
      }

      setVerificationResult(result)
      setApplicationId(result.applicationId)
      setCurrentStep(3)
    } catch (error: any) {
      alert(error.message || 'Failed to verify')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCompleteRegistration = async (data: CompleteRegistration) => {
    setFormData({ ...formData, ...data })
    setCurrentStep(4)
  }

  const handleFinalSubmit = async (data: Agreements) => {
    setIsSubmitting(true)

    try {
      const formDataObj = new window.FormData()
      formDataObj.append('applicationId', applicationId)
      formDataObj.append('email', formData.email)
      formDataObj.append('phone', formData.phone)
      formDataObj.append('address', JSON.stringify({
        street: formData.address,
        city: '',
        state: formData.licenseState,
        zipCode: '',
      }))
      formDataObj.append('ssnEncrypted', formData.ssn)
      formDataObj.append('insuranceProvider', formData.insuranceProvider)
      formDataObj.append('policyNumber', formData.policyNumber)
      formDataObj.append('policyExpiration', formData.policyExpiration)
      formDataObj.append('coverageAmount', formData.coverageAmount)
      formDataObj.append('insuranceConsent', data.insuranceConsent.toString())
      formDataObj.append('termsAccepted', data.termsAccepted.toString())
      formDataObj.append('smsConsent', data.smsConsent.toString())

      const response = await fetch(`${BACKEND_URL}/drivers/complete-application`, {
        method: 'POST',
        body: formDataObj,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      setSubmitted(true)
    } catch (error: any) {
      alert(error.message || 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[hsl(var(--surface-field))]">
        <Header />
        <div className="container pt-20 py-12">
          <Card className="max-w-2xl mx-auto text-center">
            <CardContent className="pt-12 pb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-emerald-500 mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Application Submitted!</h2>
              <p className="text-lg text-muted-foreground mb-8">
                {verificationResult?.autoApproved
                  ? '✅ Your application was auto-approved! Check your email for next steps.'
                  : 'Your application is under review. We\'ll email you within 2-3 business days.'}
              </p>
              <Button asChild size="lg">
                <a href="/">Return to Home</a>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[hsl(var(--surface-field))]">
      <Header />
      
      {/* DOT Confirmation Modal */}
      {showDotConfirmation && pendingDotResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                DOT Number Found
              </CardTitle>
              <CardDescription>Please confirm this is your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold">DOT Number:</span>
                  <span className="text-sm">#{pendingDotResult.dotNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold">Company Name:</span>
                  <span className="text-sm">{pendingDotResult.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold">Status:</span>
                  <span className={`text-sm font-semibold ${pendingDotResult.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                    {pendingDotResult.status}
                  </span>
                </div>
                {pendingDotResult.mcNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">MC Number:</span>
                    <span className="text-sm">{pendingDotResult.mcNumber}</span>
                  </div>
                )}
                {pendingDotResult.physicalAddress && (
                  <div className="pt-2 border-t">
                    <span className="text-sm font-semibold">Physical Address:</span>
                    <p className="text-sm text-muted-foreground mt-1">{pendingDotResult.physicalAddress}</p>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-900">⚠️ Important: Verify this information</p>
                <p className="text-xs text-amber-700 mt-1">
                  Make sure this is YOUR company. If any details are incorrect, click "No, re-enter" to fix your DOT number.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDotConfirmNo}
                  className="flex-1"
                >
                  No, re-enter DOT
                </Button>
                <Button
                  onClick={handleDotConfirmYes}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Yes, this is my company
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <section className="border-b border-border bg-white pt-20 py-8">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Driver Registration</h1>
            <p className="text-sm text-muted-foreground">Quick verification process - takes 3 minutes</p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of {totalSteps}</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            {currentStep === 1 && (
              <Step1Verification
                defaultValues={formData}
                onNext={handleVerification}
                isVerifying={isVerifying}
              />
            )}
            {currentStep === 2 && (
              <Step2FCRAConsent
                onNext={handleFCRAConsent}
                onBack={() => setCurrentStep(1)}
                isVerifying={isVerifying}
                dotPreVerified={dotPreVerified}
                dotResult={verificationResult?.dot}
              />
            )}
            {currentStep === 3 && (
              <Step3CompleteRegistration
                defaultValues={formData}
                verificationResult={verificationResult}
                onNext={handleCompleteRegistration}
                onBack={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 4 && (
              <Step4Agreements
                onSubmit={handleFinalSubmit}
                onBack={() => setCurrentStep(3)}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

// Step 1: Minimal Verification Data
function Step1Verification({ defaultValues, onNext, isVerifying }: any) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<VerificationData>({
    resolver: zodResolver(verificationSchema),
    defaultValues,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: License Verification</CardTitle>
        <CardDescription>We&apos;ll verify your license in seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <DatePicker
              value={watch('dateOfBirth')}
              onChange={(date) => setValue('dateOfBirth', date || '')}
            />
            {errors.dateOfBirth && <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="licenseNumber">License Number *</Label>
              <Input id="licenseNumber" {...register('licenseNumber')} placeholder="A1234567" />
              {errors.licenseNumber && <p className="text-sm text-red-500 mt-1">{errors.licenseNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="licenseState">State *</Label>
              <Select value={watch('licenseState')} onValueChange={(v) => setValue('licenseState', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.licenseState && <p className="text-sm text-red-500 mt-1">{errors.licenseState.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="dotNumber">DOT Number (Optional - for owner-operators)</Label>
            <Input id="dotNumber" {...register('dotNumber')} placeholder="12345678" />
            <p className="text-xs text-muted-foreground mt-1">
              💡 If provided, we&apos;ll verify it instantly using FREE FMCSA public data (no consent needed)
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isVerifying}>
            {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying DOT...</> : 'Continue to Verification'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 2: FCRA Consent
function Step2FCRAConsent({ onNext, onBack, isVerifying, dotPreVerified, dotResult }: any) {
  const [consent, setConsent] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <CardTitle>Step 2: Background Check Disclosure</CardTitle>
        </div>
        <CardDescription>Required by Fair Credit Reporting Act (FCRA)</CardDescription>
        {dotPreVerified && dotResult && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
            <p className="text-sm text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              ✅ DOT #{dotResult.dotNumber} Verified (Confirmed by driver)
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Company: <strong>{dotResult.companyName}</strong> • Status: <strong>{dotResult.status}</strong>
            </p>
            {dotResult.mcNumber && (
              <p className="text-xs text-emerald-700">
                MC Number: <strong>{dotResult.mcNumber}</strong>
              </p>
            )}
            {dotResult.physicalAddress && (
              <p className="text-xs text-emerald-700">
                Address: <strong>{dotResult.physicalAddress}</strong>
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-4 rounded-md space-y-2 text-sm max-h-64 overflow-y-auto">
          <p className="font-semibold">DISCLOSURE & AUTHORIZATION FOR BACKGROUND CHECK</p>
          <p>
            DriveDrop (&quot;Company&quot;) may obtain information about you from a consumer reporting agency for employment purposes.
            This includes your driving record (MVR - Motor Vehicle Report) from your state DMV.
          </p>
          <p className="font-semibold mt-2">What we check:</p>
          <ul className="list-disc list-inside pl-2">
            <li>Driving record and license status</li>
            <li>Traffic violations and suspensions</li>
            <li>DUI/DWI history</li>
            <li>License expiration and class</li>
          </ul>
          <p className="mt-2">
            <strong>Your Rights:</strong> You have the right to request a copy of any report obtained.
            If we take adverse action based on the report, you will receive notice and a copy of the report.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Full FCRA disclosure: <a href="/fcra" className="underline" target="_blank">View Complete Disclosure</a>
          </p>
        </div>

        <div className="flex items-start gap-2 p-4 border-2 border-amber-500 rounded-md bg-amber-50">
          <Checkbox
            id="fcraConsent"
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <label htmlFor="fcraConsent" className="text-sm leading-tight cursor-pointer">
            I have read and understand the background check disclosure above. I authorize DriveDrop to obtain
            my Motor Vehicle Report (MVR) for the purpose of evaluating my driver application.
            <br />
            <span className="font-semibold mt-1 inline-block">Electronic Signature: {new Date().toLocaleString()}</span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>Back</Button>
          <Button
            onClick={onNext}
            disabled={!consent || isVerifying}
            className="flex-1"
          >
            {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'I Authorize - Run Check'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 3: Complete Registration
function Step3CompleteRegistration({ defaultValues, verificationResult, onNext, onBack }: any) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CompleteRegistration>({
    resolver: zodResolver(completeRegistrationSchema),
    defaultValues,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Complete Your Profile</CardTitle>
        <CardDescription>
          {verificationResult?.mvr?.eligible && (
            <span className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              ✅ License verified! {verificationResult.mvr.licenseStatus} - CDL Class {verificationResult.mvr.cdlClass}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" {...register('phone')} placeholder="(555) 123-4567" />
              {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address *</Label>
            <GooglePlacesAutocomplete
              onSelect={(addr: string) => setValue('address', addr)}
              onInputChange={(value: string) => setValue('address', value)}
              placeholder="123 Main St, City, State"
              defaultValue={watch('address')}
            />
            {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>}
          </div>

          <div>
            <Label htmlFor="ssn">SSN (Last 4 digits) *</Label>
            <Input id="ssn" {...register('ssn')} placeholder="1234" maxLength={4} />
            {errors.ssn && <p className="text-sm text-red-500 mt-1">{errors.ssn.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="insuranceProvider">Insurance Provider *</Label>
              <Input id="insuranceProvider" {...register('insuranceProvider')} placeholder="State Farm" />
              {errors.insuranceProvider && <p className="text-sm text-red-500 mt-1">{errors.insuranceProvider.message}</p>}
            </div>
            <div>
              <Label htmlFor="policyNumber">Policy Number *</Label>
              <Input id="policyNumber" {...register('policyNumber')} />
              {errors.policyNumber && <p className="text-sm text-red-500 mt-1">{errors.policyNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="policyExpiration">Policy Expiration *</Label>
              <DatePicker
                value={watch('policyExpiration')}
                onChange={(date) => setValue('policyExpiration', date || '')}
              />
              {errors.policyExpiration && <p className="text-sm text-red-500 mt-1">{errors.policyExpiration.message}</p>}
            </div>
            <div>
              <Label htmlFor="coverageAmount">Coverage Amount *</Label>
              <Select value={watch('coverageAmount')} onValueChange={(v) => setValue('coverageAmount', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100k">$100,000</SelectItem>
                  <SelectItem value="300k">$300,000</SelectItem>
                  <SelectItem value="500k">$500,000</SelectItem>
                  <SelectItem value="1m">$1,000,000+</SelectItem>
                </SelectContent>
              </Select>
              {errors.coverageAmount && <p className="text-sm text-red-500 mt-1">{errors.coverageAmount.message}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Back</Button>
            <Button type="submit" className="flex-1">Continue to Agreements</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 4: Final Agreements
function Step4Agreements({ onSubmit, onBack, isSubmitting }: any) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Agreements>({
    resolver: zodResolver(agreementsSchema),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Final Agreements</CardTitle>
        <CardDescription>Review and accept to complete registration</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="insuranceConsent"
                checked={watch('insuranceConsent')}
                onCheckedChange={(checked) => setValue('insuranceConsent', checked === true)}
              />
              <label htmlFor="insuranceConsent" className="text-sm">
                I confirm I have valid commercial auto insurance with minimum $500k coverage.
              </label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="termsAccepted"
                checked={watch('termsAccepted')}
                onCheckedChange={(checked) => setValue('termsAccepted', checked === true)}
              />
              <label htmlFor="termsAccepted" className="text-sm">
                I accept the <a href="/terms" className="underline" target="_blank">Terms & Conditions</a> and <a href="/privacy" className="underline" target="_blank">Privacy Policy</a>.
              </label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="smsConsent"
                checked={watch('smsConsent')}
                onCheckedChange={(checked) => setValue('smsConsent', checked === true)}
              />
              <label htmlFor="smsConsent" className="text-sm">
                I consent to receive SMS updates about shipments and account activity.
              </label>
            </div>
          </div>

          {(errors.insuranceConsent || errors.termsAccepted || errors.smsConsent) && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">All agreements must be accepted to continue</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Back</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Submit Application'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
