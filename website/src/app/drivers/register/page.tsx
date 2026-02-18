'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, ArrowLeft, Upload, CheckCircle, Truck, Shield, FileText, AlertCircle } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

// Helper function to calculate age
const calculateAge = (dateString: string): number => {
  const birthDate = new Date(dateString)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

// Helper function to check if date is expired
const isDateExpired = (dateString: string): boolean => {
  const expiryDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Reset time to compare only dates
  return expiryDate < today
}

// Step 1: Personal Information (SSN REMOVED)
const personalInfoSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine((date) => {
    const age = calculateAge(date)
    return age >= 18
  }, 'You must be at least 18 years old to apply'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
})

// Step 2: Driver's License (with expiry validation)
const licenseSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseState: z.string().min(2, 'State is required'),
  licenseExpiration: z.string().min(1, 'Expiration date is required').refine((date) => {
    return !isDateExpired(date)
  }, 'Your driver\'s license has expired. Please renew it before applying'),
  licenseFront: z.any().optional(),
  licenseBack: z.any().optional(),
  proofOfAddress: z.any().optional(),
})

// Step 3: Driving History
const drivingHistorySchema = z.object({
  hasSuspensions: z.boolean(),
  hasCriminalRecord: z.boolean(),
  incidentDescription: z.string().optional(),
})

// Step 4: Insurance Information (with expiry validation)
const insuranceSchema = z.object({
  insuranceProvider: z.string().min(1, 'Insurance provider is required'),
  policyNumber: z.string().min(1, 'Policy number is required'),
  policyExpiration: z.string().min(1, 'Expiration date is required').refine((date) => {
    return !isDateExpired(date)
  }, 'Your insurance policy has expired. Please renew it before applying'),
  insuranceProof: z.any().optional(),
  coverageAmount: z.string().min(1, 'Coverage amount is required'),
})

// Step 5: Agreements
const agreementsSchema = z.object({
  backgroundCheckConsent: z.boolean().refine(val => val === true, 'You must consent to background check'),
  dataUseConsent: z.boolean().refine(val => val === true, 'You must consent to data use'),
  insuranceConsent: z.boolean().refine(val => val === true, 'You must confirm valid insurance'),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept terms and conditions'),
})

type PersonalInfo = z.infer<typeof personalInfoSchema>
type LicenseInfo = z.infer<typeof licenseSchema>
type DrivingHistory = z.infer<typeof drivingHistorySchema>
type InsuranceInfo = z.infer<typeof insuranceSchema>
type Agreements = z.infer<typeof agreementsSchema>

type FormData = PersonalInfo & LicenseInfo & DrivingHistory & InsuranceInfo & Agreements

export default function DriverRegistrationPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<FormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const totalSteps = 5
  const progress = (currentStep / totalSteps) * 100

  // Auto-scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const nextStep = (data: Partial<FormData>) => {
    setFormData({ ...formData, ...data })
    setCurrentStep(prev => Math.min(prev + 1, totalSteps))
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleFinalSubmit = async (data: Partial<FormData>) => {
    setIsSubmitting(true)
    const completeData = { ...formData, ...data }

    try {
      // Create FormData object for file uploads
      const formDataObj = new window.FormData()
      
      // Add all fields to FormData
      Object.entries(completeData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Handle file inputs
          if (value instanceof FileList && value.length > 0) {
            formDataObj.append(key, value[0])
          }
          // Handle boolean values
          else if (typeof value === 'boolean') {
            formDataObj.append(key, value.toString())
          }
          // Handle other values
          else if (typeof value === 'string' || typeof value === 'number') {
            formDataObj.append(key, value.toString())
          }
        }
      })

      const response = await fetch('/api/drivers/apply', {
        method: 'POST',
        body: formDataObj, // Send as multipart/form-data
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Application submission failed')
      }

      setSubmitted(true)
    } catch (error: any) {
      console.error('Submission error:', error)
      alert(error.message || 'Failed to submit application. Please try again.')
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
                Thank you for applying to become a DriveDrop driver. We've received your application and will review it within 3-5 business days.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                You'll receive an email at <strong>{formData.email}</strong> with updates on your application status.
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
      
      {/* Page Header */}
      <section className="border-b border-border bg-white pt-20 py-8">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md bg-amber-500 flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Driver Application</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Complete the application below to register as a DriveDrop carrier.
            </p>
            
            {/* Requirements */}
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                <span>Background check required</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-500" />
                <span>Valid license &amp; insurance</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                <span>Weekly payouts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-12">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of {totalSteps}</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} />
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
              <PersonalInfoStep
                defaultValues={formData as PersonalInfo}
                onNext={nextStep}
              />
            )}
            {currentStep === 2 && (
              <LicenseStep
                defaultValues={formData as LicenseInfo}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            {currentStep === 3 && (
              <DrivingHistoryStep
                defaultValues={formData as DrivingHistory}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            {currentStep === 4 && (
              <InsuranceStep
                defaultValues={formData as InsuranceInfo}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}
            {currentStep === 5 && (
              <AgreementsStep
                onSubmit={handleFinalSubmit}
                onBack={prevStep}
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

// Step Components
function PersonalInfoStep({ defaultValues, onNext }: any) {
  const { register, handleSubmit, formState: { errors } } = useForm<PersonalInfo>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>Please provide your basic information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Legal Name *</Label>
            <Input {...register('fullName')} placeholder="John Doe" />
            {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>}
          </div>

          <div>
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <Input type="date" {...register('dateOfBirth')} />
            {errors.dateOfBirth && <p className="text-sm text-destructive mt-1">{errors.dateOfBirth.message}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input type="email" {...register('email')} placeholder="john@example.com" />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input {...register('phone')} placeholder="(555) 123-4567" />
            {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <Label htmlFor="address">Current Address *</Label>
            <Input {...register('address')} placeholder="123 Main St, City, State, ZIP" />
            {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Age Requirement</p>
              <p>You must be at least 18 years old to become a driver. We'll verify your age from your date of birth.</p>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Next Step <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LicenseStep({ defaultValues, onNext, onBack }: any) {
  const { register, handleSubmit, formState: { errors } } = useForm<LicenseInfo>({
    resolver: zodResolver(licenseSchema),
    defaultValues,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Driver's License</CardTitle>
        <CardDescription>Upload your driver's license information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div>
            <Label htmlFor="licenseNumber">License Number *</Label>
            <Input {...register('licenseNumber')} placeholder="D1234567" />
            {errors.licenseNumber && <p className="text-sm text-destructive mt-1">{errors.licenseNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="licenseState">Issuing State *</Label>
              <Input {...register('licenseState')} placeholder="CA" maxLength={2} />
              {errors.licenseState && <p className="text-sm text-destructive mt-1">{errors.licenseState.message}</p>}
            </div>
            <div>
              <Label htmlFor="licenseExpiration">Expiration Date *</Label>
              <Input type="date" {...register('licenseExpiration')} />
              {errors.licenseExpiration && <p className="text-sm text-destructive mt-1">{errors.licenseExpiration.message}</p>}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">License Expiry Check</p>
              <p>Your driver's license must be current and not expired. Applications with expired licenses cannot be processed.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="licenseFront">Upload License (Front) *</Label>
            <Input type="file" accept="image/*,.pdf" {...register('licenseFront')} />
            <p className="text-xs text-muted-foreground mt-1">Upload a clear photo or scan</p>
          </div>

          <div>
            <Label htmlFor="licenseBack">Upload License (Back) *</Label>
            <Input type="file" accept="image/*,.pdf" {...register('licenseBack')} />
          </div>

          <div>
            <Label htmlFor="proofOfAddress">Proof of Address *</Label>
            <Input type="file" accept="image/*,.pdf" {...register('proofOfAddress')} />
            <p className="text-xs text-muted-foreground mt-1">Utility bill, lease agreement, or bank statement</p>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="w-full">
              Next Step <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function DrivingHistoryStep({ defaultValues, onNext, onBack }: any) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<DrivingHistory>({
    resolver: zodResolver(drivingHistorySchema),
    defaultValues: {
      hasSuspensions: false,
      hasCriminalRecord: false,
      ...defaultValues,
    },
  })

  const hasSuspensions = watch('hasSuspensions')
  const hasCriminalRecord = watch('hasCriminalRecord')
  const needsDescription = hasSuspensions || hasCriminalRecord

  return (
    <Card>
      <CardHeader>
        <CardTitle>Driving History</CardTitle>
        <CardDescription>Help us understand your driving record</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={hasSuspensions}
                onCheckedChange={(checked) => setValue('hasSuspensions', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>Any license suspensions or DUIs in the past 5 years?</Label>
                <p className="text-sm text-muted-foreground">Check if yes</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={hasCriminalRecord}
                onCheckedChange={(checked) => setValue('hasCriminalRecord', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>Any criminal record?</Label>
                <p className="text-sm text-muted-foreground">Check if yes</p>
              </div>
            </div>
          </div>

          {needsDescription && (
            <div>
              <Label htmlFor="incidentDescription">Description of Incident(s)</Label>
              <Textarea
                {...register('incidentDescription')}
                placeholder="Please provide details..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This information helps us make an informed decision. Disclosure doesn't automatically disqualify you.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="w-full">
              Next Step <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function InsuranceStep({ defaultValues, onNext, onBack }: any) {
  const { register, handleSubmit, formState: { errors } } = useForm<InsuranceInfo>({
    resolver: zodResolver(insuranceSchema),
    defaultValues,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurance Information</CardTitle>
        <CardDescription>Verify your auto insurance coverage</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div>
            <Label htmlFor="insuranceProvider">Insurance Provider *</Label>
            <Input {...register('insuranceProvider')} placeholder="State Farm, Geico, etc." />
            {errors.insuranceProvider && <p className="text-sm text-destructive mt-1">{errors.insuranceProvider.message}</p>}
          </div>

          <div>
            <Label htmlFor="policyNumber">Policy Number *</Label>
            <Input {...register('policyNumber')} placeholder="POL123456789" />
            {errors.policyNumber && <p className="text-sm text-destructive mt-1">{errors.policyNumber.message}</p>}
          </div>

          <div>
            <Label htmlFor="policyExpiration">Policy Expiration Date *</Label>
            <Input type="date" {...register('policyExpiration')} />
            {errors.policyExpiration && <p className="text-sm text-destructive mt-1">{errors.policyExpiration.message}</p>}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Insurance Expiry Check</p>
              <p>Your insurance policy must be current and not expired. Applications with expired insurance cannot be processed.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="insuranceProof">Upload Proof of Insurance *</Label>
            <Input type="file" accept="image/*,.pdf" {...register('insuranceProof')} />
            <p className="text-xs text-muted-foreground mt-1">Insurance card or policy document</p>
          </div>

          <div>
            <Label htmlFor="coverageAmount">Coverage Amount *</Label>
            <Input {...register('coverageAmount')} placeholder="$100,000 / $300,000" />
            <p className="text-xs text-muted-foreground mt-1">Liability and damage coverage amounts</p>
            {errors.coverageAmount && <p className="text-sm text-destructive mt-1">{errors.coverageAmount.message}</p>}
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="w-full">
              Next Step <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function AgreementsStep({ onSubmit, onBack, isSubmitting }: any) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Agreements>({
    resolver: zodResolver(agreementsSchema),
    defaultValues: {
      backgroundCheckConsent: false,
      dataUseConsent: false,
      insuranceConsent: false,
      termsAccepted: false,
    },
  })

  const backgroundCheckConsent = watch('backgroundCheckConsent')
  const dataUseConsent = watch('dataUseConsent')
  const insuranceConsent = watch('insuranceConsent')
  const termsAccepted = watch('termsAccepted')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agreements & Consent</CardTitle>
        <CardDescription>Please review and accept the following terms</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={backgroundCheckConsent}
                onCheckedChange={(checked) => setValue('backgroundCheckConsent', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>I consent to a background check</Label>
                <p className="text-sm text-muted-foreground">
                  Required under the Fair Credit Reporting Act (FCRA). <a href="/fcra" className="underline">Learn more</a>
                </p>
              </div>
            </div>
            {errors.backgroundCheckConsent && <p className="text-sm text-destructive">{errors.backgroundCheckConsent.message}</p>}

            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={dataUseConsent}
                onCheckedChange={(checked) => setValue('dataUseConsent', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>I agree to data use for verification</Label>
                <p className="text-sm text-muted-foreground">
                  Your information will be used solely for driver verification purposes
                </p>
              </div>
            </div>
            {errors.dataUseConsent && <p className="text-sm text-destructive">{errors.dataUseConsent.message}</p>}

            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={insuranceConsent}
                onCheckedChange={(checked) => setValue('insuranceConsent', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>I confirm I have valid auto insurance</Label>
                <p className="text-sm text-muted-foreground">
                  You must maintain active insurance coverage while driving for DriveDrop
                </p>
              </div>
            </div>
            {errors.insuranceConsent && <p className="text-sm text-destructive">{errors.insuranceConsent.message}</p>}

            <div className="flex items-start space-x-3">
              <Checkbox 
                checked={termsAccepted}
                onCheckedChange={(checked) => setValue('termsAccepted', checked as boolean)}
              />
              <div className="space-y-1">
                <Label>I accept the Terms of Service and Privacy Policy</Label>
                <p className="text-sm text-muted-foreground">
                  <a href="/terms" className="underline">Terms of Service</a> • <a href="/privacy" className="underline">Privacy Policy</a>
                </p>
              </div>
            </div>
            {errors.termsAccepted && <p className="text-sm text-destructive">{errors.termsAccepted.message}</p>}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Legal Disclosure</h4>
            <p className="text-sm text-muted-foreground">
              By clicking Submit, you confirm that all information provided is accurate and complete. 
              Misrepresentation of any information may lead to disqualification from the DriveDrop driver program. 
              You have the right to request your background report and dispute any errors under the Fair Credit Reporting Act (FCRA).
            </p>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="w-full" disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
