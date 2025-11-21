'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, MapPin, Car, Calendar, FileText, DollarSign, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import AddressAutocomplete from './AddressAutocomplete'
import { pricingService } from '@/services/pricingService'

interface ShipmentData {
  // Customer Info
  customerName: string
  customerEmail: string
  customerPhone: string
  
  // Locations
  pickupAddress: string
  pickupCoordinates?: { lat: number; lng: number }
  deliveryAddress: string
  deliveryCoordinates?: { lat: number; lng: number }
  pickupDate: string
  deliveryDate: string
  
  // Vehicle Details
  vehicleType: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  isOperable: boolean
  
  // Shipment Details
  shipmentType: string
  specialInstructions: string
  
  // Pricing
  estimatedPrice: number
  distance: number
}

interface ShipmentFormProps {
  onSubmit: (data: ShipmentData) => void
  isSubmitting: boolean
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  isValid: boolean
  summary?: string
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  isValid,
  summary
}) => {
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent form submission
    e.stopPropagation() // Stop event bubbling
    onToggle()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        type="button" // Explicitly set type to button to prevent form submission
        onClick={handleToggle}
        className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
          isExpanded ? 'border-b border-gray-200 bg-teal-50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`${isValid ? 'text-green-600' : 'text-teal-600'}`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isValid && !isExpanded && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isExpanded && summary && (
            <span className="text-sm text-gray-500 max-w-xs truncate">{summary}</span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-6 py-6 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ShipmentForm({ onSubmit, isSubmitting }: ShipmentFormProps) {
  const { profile } = useAuth()
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    customer: true,
    locations: false,
    vehicle: false,
    details: false,
    pricing: false,
  })

  // Form data
  const [formData, setFormData] = useState<ShipmentData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    pickupAddress: '',
    deliveryAddress: '',
    pickupDate: '',
    deliveryDate: '',
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    isOperable: true,
    shipmentType: 'standard',
    specialInstructions: '',
    estimatedPrice: 0,
    distance: 0,
  })

  // Auto-fill customer info when profile loads
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        customerName: profile.first_name && profile.last_name 
          ? `${profile.first_name} ${profile.last_name}` 
          : prev.customerName,
        customerEmail: profile.email || prev.customerEmail,
        customerPhone: profile.phone || prev.customerPhone,
      }))
    }
  }, [profile])

  // Section validity
  const [sectionValidity, setSectionValidity] = useState({
    customer: false,
    locations: false,
    vehicle: false,
    details: false,
    pricing: false,
  })

  // Calculate section validity
  useEffect(() => {
    setSectionValidity({
      customer: !!(formData.customerName && formData.customerEmail && formData.customerPhone),
      locations: !!(formData.pickupAddress && formData.deliveryAddress && formData.pickupDate),
      vehicle: !!(formData.vehicleType && formData.vehicleMake && formData.vehicleModel && formData.vehicleYear),
      details: !!(formData.shipmentType),
      pricing: formData.estimatedPrice > 0,
    })
  }, [formData])

  // Recalculate price when vehicle type, dates, or distance changes
  useEffect(() => {
    if (formData.distance > 0 && formData.vehicleType) {
      calculatePrice(formData.distance)
    }
  }, [formData.vehicleType, formData.pickupDate, formData.deliveryDate, formData.distance])

  const toggleSection = (section: keyof typeof expandedSections) => {
    // Only toggle the clicked section, don't auto-expand others
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const updateFormData = (field: keyof ShipmentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddressSelect = (field: 'pickupAddress' | 'deliveryAddress', address: string, coordinates: { lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      [field]: address,
      [`${field === 'pickupAddress' ? 'pickup' : 'delivery'}Coordinates`]: coordinates,
    }))
    
    // Calculate distance if both addresses are set
    if (field === 'pickupAddress' && formData.deliveryCoordinates) {
      calculateDistance(coordinates, formData.deliveryCoordinates)
    } else if (field === 'deliveryAddress' && formData.pickupCoordinates) {
      calculateDistance(formData.pickupCoordinates, coordinates)
    }
  }

  const calculateDistance = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    // Use pricing service haversine formula with road multiplier
    const distance = pricingService.calculateDistance(from.lat, from.lng, to.lat, to.lng)
    
    updateFormData('distance', Math.round(distance))
    
    // Auto-calculate price based on distance
    calculatePrice(Math.round(distance))
  }

  const calculatePrice = (distance: number) => {
    // Don't calculate if no vehicle type selected
    if (!formData.vehicleType) {
      console.log('No vehicle type selected, skipping price calculation')
      return
    }

    // Use proper pricing service that matches mobile app exactly
    const quote = pricingService.calculateQuote({
      vehicleType: formData.vehicleType,
      distanceMiles: distance,
      isAccidentRecovery: false,
      vehicleCount: 1,
      pickupDate: formData.pickupDate,
      deliveryDate: formData.deliveryDate,
      fuelPricePerGallon: 3.70, // Default current fuel price
    })
    
    // Only update if price changed to prevent infinite loop
    if (formData.estimatedPrice !== quote.total) {
      updateFormData('estimatedPrice', quote.total)
    }
    
    // Log breakdown for debugging
    console.log('Pricing Breakdown:', {
      vehicleType: formData.vehicleType,
      distance,
      breakdown: quote.breakdown
    })
  }

  const getSummary = (section: keyof typeof expandedSections) => {
    switch (section) {
      case 'customer':
        return formData.customerName || 'Not filled'
      case 'locations':
        return formData.pickupAddress ? `${formData.pickupAddress.split(',')[0]} → ${formData.deliveryAddress.split(',')[0]}` : 'Not filled'
      case 'vehicle':
        return formData.vehicleMake ? `${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}` : 'Not filled'
      case 'details':
        return formData.shipmentType === 'expedited' ? 'Expedited' : 'Standard'
      case 'pricing':
        return formData.estimatedPrice > 0 ? `$${formData.estimatedPrice.toFixed(2)}` : 'Not calculated'
      default:
        return ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate all sections
    const allValid = Object.values(sectionValidity).every(valid => valid)
    if (!allValid) {
      // Show which sections are incomplete
      const incomplete = []
      if (!sectionValidity.customer) incomplete.push('Customer Information')
      if (!sectionValidity.locations) incomplete.push('Pickup & Delivery Locations')
      if (!sectionValidity.vehicle) incomplete.push('Vehicle Details')
      if (!sectionValidity.details) incomplete.push('Shipment Details')
      if (!sectionValidity.pricing) incomplete.push('Pricing (complete locations first)')
      
      alert(`Please complete the following sections:\n\n• ${incomplete.join('\n• ')}`)
      return
    }
    
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer Information */}
      <CollapsibleSection
        title="Customer Information"
        icon={<FileText className="h-5 w-5" />}
        isExpanded={expandedSections.customer}
        onToggle={() => toggleSection('customer')}
        isValid={sectionValidity.customer}
        summary={getSummary('customer')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customerName">Full Name *</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => updateFormData('customerName', e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div>
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              id="customerEmail"
              type="email"
              value={formData.customerEmail}
              onChange={(e) => updateFormData('customerEmail', e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="customerPhone">Phone Number *</Label>
            <Input
              id="customerPhone"
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => updateFormData('customerPhone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              required
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Locations */}
      <CollapsibleSection
        title="Pickup & Delivery Locations"
        icon={<MapPin className="h-5 w-5" />}
        isExpanded={expandedSections.locations}
        onToggle={() => toggleSection('locations')}
        isValid={sectionValidity.locations}
        summary={getSummary('locations')}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="pickupAddress">Pickup Address *</Label>
            <AddressAutocomplete
              value={formData.pickupAddress}
              onSelect={(address: string, coords: { lat: number; lng: number }) => handleAddressSelect('pickupAddress', address, coords)}
              placeholder="Enter pickup address"
            />
          </div>
          <div>
            <Label htmlFor="deliveryAddress">Delivery Address *</Label>
            <AddressAutocomplete
              value={formData.deliveryAddress}
              onSelect={(address: string, coords: { lat: number; lng: number }) => handleAddressSelect('deliveryAddress', address, coords)}
              placeholder="Enter delivery address"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pickupDate">Preferred Pickup Date *</Label>
              <Input
                id="pickupDate"
                type="date"
                value={formData.pickupDate}
                onChange={(e) => updateFormData('pickupDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div>
              <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => updateFormData('deliveryDate', e.target.value)}
                min={formData.pickupDate || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          {formData.distance > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                Estimated distance: <strong>{formData.distance} miles</strong>
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Vehicle Details */}
      <CollapsibleSection
        title="Vehicle Details"
        icon={<Car className="h-5 w-5" />}
        isExpanded={expandedSections.vehicle}
        onToggle={() => toggleSection('vehicle')}
        isValid={sectionValidity.vehicle}
        summary={getSummary('vehicle')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vehicleType">Vehicle Type *</Label>
              <select
                id="vehicleType"
                value={formData.vehicleType}
                onChange={(e) => updateFormData('vehicleType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Select type</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Truck">Truck</option>
                <option value="Van">Van</option>
                <option value="Coupe">Coupe</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="RV/Trailer">RV/Trailer</option>
                <option value="Boat">Boat</option>
              </select>
            </div>
            <div>
              <Label htmlFor="vehicleYear">Year *</Label>
              <Input
                id="vehicleYear"
                type="number"
                value={formData.vehicleYear}
                onChange={(e) => updateFormData('vehicleYear', e.target.value)}
                placeholder="2020"
                min="1900"
                max={new Date().getFullYear() + 1}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vehicleMake">Make *</Label>
              <Input
                id="vehicleMake"
                value={formData.vehicleMake}
                onChange={(e) => updateFormData('vehicleMake', e.target.value)}
                placeholder="Toyota"
                required
              />
            </div>
            <div>
              <Label htmlFor="vehicleModel">Model *</Label>
              <Input
                id="vehicleModel"
                value={formData.vehicleModel}
                onChange={(e) => updateFormData('vehicleModel', e.target.value)}
                placeholder="Camry"
                required
              />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isOperable}
                onChange={(e) => updateFormData('isOperable', e.target.checked)}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              Vehicle is operable
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              Check if the vehicle can be driven onto the transport truck
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Shipment Details */}
      <CollapsibleSection
        title="Shipment Details"
        icon={<Calendar className="h-5 w-5" />}
        isExpanded={expandedSections.details}
        onToggle={() => toggleSection('details')}
        isValid={sectionValidity.details}
        summary={getSummary('details')}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="shipmentType">Service Type *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => updateFormData('shipmentType', 'standard')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  formData.shipmentType === 'standard'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Standard</div>
                <div className="text-sm text-gray-600">7-10 business days</div>
              </button>
              <button
                type="button"
                onClick={() => updateFormData('shipmentType', 'expedited')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  formData.shipmentType === 'expedited'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Expedited</div>
                <div className="text-sm text-gray-600">3-5 business days</div>
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => updateFormData('specialInstructions', e.target.value)}
              placeholder="Any special handling requirements or notes..."
              rows={4}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Pricing Summary */}
      <CollapsibleSection
        title="Pricing Summary"
        icon={<DollarSign className="h-5 w-5" />}
        isExpanded={expandedSections.pricing}
        onToggle={() => toggleSection('pricing')}
        isValid={sectionValidity.pricing}
        summary={getSummary('pricing')}
      >
        <div className="space-y-4">
          {formData.estimatedPrice > 0 ? (
            <>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-700">Base Rate:</span>
                  <span className="text-gray-900 font-semibold">
                    ${(formData.estimatedPrice * 0.6).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-700">Distance Charge ({formData.distance} miles):</span>
                  <span className="text-gray-900 font-semibold">
                    ${(formData.estimatedPrice * 0.4).toFixed(2)}
                  </span>
                </div>
                {formData.shipmentType === 'expedited' && (
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-700">Expedited Service:</span>
                    <span className="text-orange-600 font-semibold">+25%</span>
                  </div>
                )}
                <div className="border-t border-teal-300 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Quote:</span>
                    <span className="text-2xl font-bold text-teal-600">
                      ${formData.estimatedPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Payment Structure:</h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>20% Initial Payment:</strong> ${(formData.estimatedPrice * 0.20).toFixed(2)} due at booking
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>80% Final Payment:</strong> ${(formData.estimatedPrice * 0.80).toFixed(2)} charged upon delivery
                    </span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>Complete the pickup and delivery locations to see pricing</p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Submit Button */}
      <div className="pt-6">
        <Button
          type="submit"
          disabled={isSubmitting || !Object.values(sectionValidity).every(valid => valid)}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-semibold"
        >
          {isSubmitting ? 'Processing...' : 'Continue to Completion'}
        </Button>
      </div>
    </form>
  )
}
