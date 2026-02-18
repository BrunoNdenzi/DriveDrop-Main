'use client'

import { useState } from 'react'
import { Check, AlertCircle, FileText, Shield, DollarSign, Truck } from 'lucide-react'

interface TermsAndConditionsStepProps {
  shipmentData: any
  accepted: boolean
  onAcceptanceUpdate: (accepted: boolean) => void
}

const TERMS_SECTIONS = [
  {
    id: 'payment',
    title: 'Payment Terms',
    icon: DollarSign,
    items: [
      'A 20% deposit is required at booking to secure your shipment and confirm the service.',
      'The remaining 80% will be pre-authorized on your payment method at booking time.',
      'The final 80% payment will be automatically charged upon successful delivery of your vehicle.',
      'You will receive a receipt and invoice for both payments.',
      'Refunds for the pre-authorized 80% are subject to our cancellation policy and delivery confirmation.',
    ]
  },
  {
    id: 'cancellation',
    title: 'Cancellation Policy',
    icon: AlertCircle,
    items: [
      'Cancellations made 48+ hours before pickup: Full refund minus 10% processing fee',
      'Cancellations made 24-48 hours before pickup: 50% refund',
      'Cancellations made less than 24 hours before pickup: No refund',
      'If driver finds major discrepancies during pickup verification, full refund available',
      'Admin may cancel and refund for safety or legal concerns',
    ]
  },
  {
    id: 'liability',
    title: 'Liability & Insurance',
    icon: Shield,
    items: [
      'DriveDrop carries cargo insurance covering up to $100,000 per vehicle',
      'Customer is responsible for vehicle insurance during transport',
      'Drivers are verified and background-checked',
      'Any damage must be reported within 24 hours of delivery',
      'Document vehicle condition with photos at pickup and delivery',
    ]
  },
  {
    id: 'responsibilities',
    title: 'Customer Responsibilities',
    icon: FileText,
    items: [
      'Provide accurate vehicle information and condition',
      'Upload clear photos documenting current vehicle condition',
      'Ensure vehicle is ready for pickup at scheduled time',
      'Remove all personal items from vehicle before transport',
      'Provide valid proof of ownership documents',
      'Vehicle must be in running condition (unless specified as non-operable)',
    ]
  },
  {
    id: 'delivery',
    title: 'Delivery Terms',
    icon: Truck,
    items: [
      'Estimated delivery times are approximate and not guaranteed',
      'Customer will be notified when driver is en route to delivery location',
      'Customer or authorized representative must be present for delivery',
      'Inspect vehicle immediately upon delivery and note any concerns',
      'Sign delivery confirmation to complete the shipment',
      'Final payment is processed automatically after delivery confirmation',
    ]
  },
]

export default function TermsAndConditionsStep({ shipmentData, accepted, onAcceptanceUpdate }: TermsAndConditionsStepProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['payment'])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const upfrontAmount = (shipmentData.estimatedPrice * 0.20).toFixed(2)
  const deliveryAmount = (shipmentData.estimatedPrice * 0.80).toFixed(2)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <p className="text-gray-600">
          Please review our terms and conditions before proceeding with your shipment
        </p>
      </div>

      {/* Quote Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Your Shipment Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-700">Vehicle:</span>
            <span className="font-semibold text-gray-900">
              {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Route:</span>
            <span className="font-semibold text-gray-900 text-right">
              {shipmentData.pickupAddress.split(',')[0]} → {shipmentData.deliveryAddress.split(',')[0]}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Distance:</span>
            <span className="font-semibold text-gray-900">
              {shipmentData.distance} miles
            </span>
          </div>
          <div className="border-t border-blue-300 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total Quote:</span>
              <span className="text-lg font-semibold text-blue-500">
                ${shipmentData.estimatedPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="font-semibold text-blue-900 mb-4">Payment Structure</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">Initial Deposit (20%)</p>
              <p className="text-sm text-blue-700">Charged now to confirm booking</p>
            </div>
            <span className="text-sm font-semibold text-blue-900">${upfrontAmount}</span>
          </div>
          <div className="border-t border-blue-300 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">Final Payment (80%)</p>
                <p className="text-sm text-blue-700">Charged automatically upon delivery</p>
              </div>
              <span className="text-sm font-semibold text-blue-900">${deliveryAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Sections */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h3>
        {TERMS_SECTIONS.map((section) => {
          const Icon = section.icon
          const isExpanded = expandedSections.includes(section.id)
          
          return (
            <div key={section.id} className="border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-gray-900">{section.title}</span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-6 pb-4 bg-gray-50">
                  <ul className="space-y-2">
                    {section.items.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Full Terms Link */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <p className="text-sm text-gray-600 text-center">
          For complete terms and conditions, visit our{' '}
          <a href="/terms" target="_blank" className="text-blue-500 hover:text-blue-600 font-medium underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" className="text-blue-500 hover:text-blue-600 font-medium underline">
            Privacy Policy
          </a>
        </p>
      </div>

      {/* Acceptance Checkbox */}
      <div className="bg-white border-2 border-blue-200 rounded-md p-4">
        <label className="flex items-start gap-4 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAcceptanceUpdate(e.target.checked)}
            className="mt-1 w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 mb-1">
              I accept the Terms & Conditions
            </p>
            <p className="text-sm text-gray-600">
              By checking this box, I confirm that I have read, understood, and agree to be bound by DriveDrop's Terms of Service, 
              Privacy Policy, and the terms outlined above. I understand the payment structure (20% deposit + 80% on delivery) and 
              cancellation policy.
            </p>
          </div>
        </label>
      </div>

      {/* Warning if not accepted */}
      {!accepted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              You must accept the terms and conditions to proceed with payment
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
