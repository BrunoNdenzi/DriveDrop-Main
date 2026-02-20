'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { 
  ArrowLeft, 
  MapPin, 
  Package, 
  DollarSign, 
  Calendar,
  Phone,
  User,
  Navigation,
  Camera,
  CheckCircle,
  Clock,
  Truck,
  MessageCircle,
  FileText,
  Download,
  Mail
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import DriverMapNavigation, { type NavStop } from '@/components/driver/DriverMapNavigation'

interface Shipment {
  id: string
  title: string
  description: string
  pickup_address: string
  delivery_address: string
  pickup_city: string
  pickup_state: string
  pickup_zip: string
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  pickup_date: string
  delivery_date: string
  estimated_price: number
  total_price: number
  distance: number
  status: string
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  vehicle_color: string
  vehicle_vin: string
  is_operable: boolean
  special_instructions: string
  client: {
    first_name: string
    last_name: string
    phone: string
    email: string
  }
  driver_arrival_time: string | null
  actual_pickup_time: string | null
  actual_delivery_time: string | null
  created_at: string
  payment_status: string
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  payment_status: string
  stripe_payment_intent_id: string
  created_at: string
}

const STATUS_FLOW = [
  { value: 'accepted', label: 'Accepted', icon: CheckCircle, color: 'blue' },
  { value: 'driver_en_route', label: 'En Route to Pickup', icon: Truck, color: 'indigo' },
  { value: 'driver_arrived', label: 'Arrived at Pickup', icon: MapPin, color: 'purple' },
  { value: 'pickup_verified', label: 'Pickup Verified', icon: Camera, color: 'pink' },
  { value: 'picked_up', label: 'Vehicle Picked Up', icon: Package, color: 'orange' },
  { value: 'in_transit', label: 'In Transit', icon: Navigation, color: 'yellow' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' }
]

export default function DriverShipmentTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [sendingReceipt, setSendingReceipt] = useState(false)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id && params.id) {
      fetchShipmentData()
    }
  }, [profile?.id, params.id])

  const fetchShipmentData = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq('id', params.id)
        .eq('driver_id', profile?.id)
        .single()

      if (error) throw error

      setShipment(data)

      // Fetch payment info
      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .eq('shipment_id', params.id)
        .single()

      if (paymentData) {
        setPayment(paymentData)
      }
    } catch (error) {
      console.error('Error fetching shipment:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!shipment) return

    try {
      setUpdating(true)

      const updates: any = { status: newStatus }

      // Set timestamps based on status
      if (newStatus === 'driver_arrived') {
        updates.driver_arrival_time = new Date().toISOString()
      } else if (newStatus === 'picked_up') {
        updates.actual_pickup_time = new Date().toISOString()
      } else if (newStatus === 'delivered') {
        updates.actual_delivery_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', params.id)

      if (error) throw error

      setShipment({ ...shipment, ...updates })
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const sendReceipt = async () => {
    if (!shipment || !payment) return

    try {
      setSendingReceipt(true)

      const response = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: shipment.id,
          clientEmail: shipment.client.email,
        }),
      })

      if (!response.ok) throw new Error('Failed to send receipt')

      alert('Receipt sent successfully!')
    } catch (error) {
      console.error('Error sending receipt:', error)
      alert('Failed to send receipt')
    } finally {
      setSendingReceipt(false)
    }
  }

  const downloadReceipt = () => {
    if (!shipment || !payment) return

    const receipt = generateReceiptHTML(shipment, payment)
    const blob = new Blob([receipt], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${shipment.id}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateReceiptHTML = (shipment: Shipment, payment: Payment) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .detail-label { font-weight: bold; }
    .total { font-size: 1.5em; font-weight: bold; color: #10B981; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DriveDrop</h1>
    <p>Vehicle Shipping Receipt</p>
    <p>Receipt #: ${payment.id}</p>
    <p>Date: ${new Date(payment.created_at).toLocaleDateString()}</p>
  </div>

  <div class="section">
    <h2>Customer Information</h2>
    <div class="detail-row">
      <span class="detail-label">Name:</span>
      <span>${shipment.client.first_name} ${shipment.client.last_name}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Email:</span>
      <span>${shipment.client.email}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Phone:</span>
      <span>${shipment.client.phone}</span>
    </div>
  </div>

  <div class="section">
    <h2>Vehicle Information</h2>
    <div class="detail-row">
      <span class="detail-label">Vehicle:</span>
      <span>${shipment.vehicle_year} ${shipment.vehicle_make} ${shipment.vehicle_model}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Color:</span>
      <span>${shipment.vehicle_color}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">VIN:</span>
      <span>${shipment.vehicle_vin}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Condition:</span>
      <span>${shipment.is_operable ? 'Operable' : 'Inoperable'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Shipment Details</h2>
    <div class="detail-row">
      <span class="detail-label">From:</span>
      <span>${shipment.pickup_address}, ${shipment.pickup_city}, ${shipment.pickup_state} ${shipment.pickup_zip}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">To:</span>
      <span>${shipment.delivery_address}, ${shipment.delivery_city}, ${shipment.delivery_state} ${shipment.delivery_zip}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Distance:</span>
      <span>${shipment.distance} miles</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Pickup Date:</span>
      <span>${new Date(shipment.pickup_date).toLocaleDateString()}</span>
    </div>
    ${shipment.actual_delivery_time ? `
    <div class="detail-row">
      <span class="detail-label">Delivery Date:</span>
      <span>${new Date(shipment.actual_delivery_time).toLocaleDateString()}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Payment Information</h2>
    <div class="detail-row">
      <span class="detail-label">Total Amount:</span>
      <span class="total">$${shipment.total_price.toFixed(2)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment Status:</span>
      <span>${payment.payment_status}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment Method:</span>
      <span>${payment.payment_method}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Transaction ID:</span>
      <span>${payment.stripe_payment_intent_id}</span>
    </div>
  </div>

  <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p>Thank you for choosing DriveDrop!</p>
    <p style="color: #666; font-size: 0.9em;">For questions, contact support@drivedrop.com</p>
  </div>
</body>
</html>
    `
  }

  const getCurrentStatusIndex = () => {
    return STATUS_FLOW.findIndex(s => s.value === shipment?.status)
  }

  const getNextStatus = () => {
    const currentIndex = getCurrentStatusIndex()
    if (currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1]
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Shipment not found</p>
          <Button onClick={() => router.push('/dashboard/driver/active')}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const nextStatus = getNextStatus()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard/driver/active')}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{shipment.title}</h1>
                <p className="text-sm text-gray-600">Shipment ID: {shipment.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/driver/messages/${shipment.id}`}>
                <Button variant="outline">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message Client
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Map with Navigation */}
            <div className="bg-white rounded-md border overflow-hidden">
              <DriverMapNavigation
                stops={[
                  ...((['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)) ? [{
                    id: `pickup-${shipment.id}`,
                    address: `${shipment.pickup_address}, ${shipment.pickup_city}, ${shipment.pickup_state} ${shipment.pickup_zip}`,
                    type: 'pickup' as const,
                    lat: shipment.pickup_lat,
                    lng: shipment.pickup_lng,
                    label: 'Pickup',
                    vehicleInfo: shipment.title,
                    order: 1,
                  }] : []),
                  {
                    id: `delivery-${shipment.id}`,
                    address: `${shipment.delivery_address}, ${shipment.delivery_city}, ${shipment.delivery_state} ${shipment.delivery_zip}`,
                    type: 'delivery' as const,
                    lat: shipment.delivery_lat,
                    lng: shipment.delivery_lng,
                    label: 'Delivery',
                    vehicleInfo: shipment.title,
                    order: (['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)) ? 2 : 1,
                  },
                ]}
                height="h-96"
                showOverlay={true}
              />
            </div>

            {/* Status Progress */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Shipment Progress</h2>
              <div className="space-y-3">
                {STATUS_FLOW.map((status, index) => {
                  const Icon = status.icon
                  const currentIndex = getCurrentStatusIndex()
                  const isCompleted = index <= currentIndex
                  const isCurrent = index === currentIndex

                  return (
                    <div key={status.value} className="flex items-center gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                          {status.label}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded">
                          Current
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {nextStatus && shipment.status !== 'delivered' && (
                <div className="mt-6 pt-6 border-t">
                  <Button
                    onClick={() => updateStatus(nextStatus.value)}
                    disabled={updating}
                    className="w-full"
                  >
                    {updating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <nextStatus.icon className="h-4 w-4 mr-2" />
                        Mark as {nextStatus.label}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Vehicle Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Year Make Model</p>
                  <p className="font-medium">{shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Color</p>
                  <p className="font-medium">{shipment.vehicle_color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">VIN</p>
                  <p className="font-medium font-mono text-sm">{shipment.vehicle_vin}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Condition</p>
                  <p className="font-medium">{shipment.is_operable ? 'Operable' : 'Inoperable'}</p>
                </div>
              </div>
              {shipment.special_instructions && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                  <p className="text-sm font-medium text-gray-700">Special Instructions:</p>
                  <p className="text-sm text-gray-600 mt-1">{shipment.special_instructions}</p>
                </div>
              )}
            </div>

            {/* Receipt Section */}
            {shipment.status === 'delivered' && payment && (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Receipt & Invoice</h2>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={downloadReceipt}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Receipt
                  </Button>
                  <Button
                    onClick={sendReceipt}
                    disabled={sendingReceipt}
                    className="flex-1"
                  >
                    {sendingReceipt ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Email to Client
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Client Info */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Client Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{shipment.client.first_name} {shipment.client.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <a href={`tel:${shipment.client.phone}`} className="font-medium text-blue-600 hover:underline">
                      {shipment.client.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <a href={`mailto:${shipment.client.email}`} className="font-medium text-blue-600 hover:underline">
                      {shipment.client.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Route Details */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Route Details</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pickup</p>
                      <p className="text-sm text-gray-600">{shipment.pickup_address}</p>
                      <p className="text-sm text-gray-600">{shipment.pickup_city}, {shipment.pickup_state} {shipment.pickup_zip}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Delivery</p>
                      <p className="text-sm text-gray-600">{shipment.delivery_address}</p>
                      <p className="text-sm text-gray-600">{shipment.delivery_city}, {shipment.delivery_state} {shipment.delivery_zip}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600">Distance</p>
                  <p className="text-lg font-semibold text-gray-900">{shipment.distance} miles</p>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            {payment && (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Payment Information</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-lg font-bold text-green-600">${shipment.total_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      payment.payment_status === 'succeeded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.payment_status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-medium">{payment.payment_method}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {shipment.status === 'accepted' && (
                  <Link href={`/dashboard/driver/pickup-verification/${shipment.id}`}>
                    <Button variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Verify Pickup
                    </Button>
                  </Link>
                )}
                {shipment.status === 'in_transit' && (
                  <Link href={`/dashboard/driver/delivery-complete/${shipment.id}`}>
                    <Button variant="outline" className="w-full">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Delivery
                    </Button>
                  </Link>
                )}
                <Link href={`/dashboard/driver/messages/${shipment.id}`}>
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contact Client
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
