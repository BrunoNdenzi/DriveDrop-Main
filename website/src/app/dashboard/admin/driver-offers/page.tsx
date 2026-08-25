'use client'

import { useEffect, useState } from 'react'
import { Check, MapPin, RefreshCw, ShieldAlert, Truck, X } from '@/components/icons/streamline-lucide'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import {
  getDirectDriverOfferReviews,
  reviewDirectDriverOffer,
  type DirectDriverOfferReview,
} from '@/lib/api/direct-driver-offers'

interface DraftReview {
  amount: string
  notes: string
}

function currency(value: number | null): string {
  return value === null ? 'Unavailable' : `$${value.toFixed(2)}`
}

export default function AdminDriverOffersPage() {
  const { profile, loading: authLoading } = useAuth()
  const [shipments, setShipments] = useState<DirectDriverOfferReview[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftReview>>({})
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.role === 'admin') {
      void loadReviews()
    }
  }, [profile])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const reviews = await getDirectDriverOfferReviews()
      setShipments(reviews)
      setDrafts(current => Object.fromEntries(reviews.map(review => [
        review.id,
        current[review.id] || {
          amount: review.driver_offer_amount?.toFixed(2)
            || review.maximumSafeDriverOffer?.toFixed(2)
            || '',
          notes: '',
        },
      ])))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load driver offers', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateDraft = (shipmentId: string, updates: Partial<DraftReview>) => {
    setDrafts(current => ({
      ...current,
      [shipmentId]: {
        amount: current[shipmentId]?.amount || '',
        notes: current[shipmentId]?.notes || '',
        ...updates,
      },
    }))
  }

  const submitReview = async (shipment: DirectDriverOfferReview, action: 'approve' | 'decline') => {
    const draft = drafts[shipment.id] || { amount: '', notes: '' }
    if (action === 'decline' && draft.notes.trim().length < 3) {
      toast('Add a decline reason before submitting', 'error')
      return
    }

    const amount = Number(draft.amount)
    if (action === 'approve' && (!Number.isFinite(amount) || amount <= 0)) {
      toast('Enter a valid all-in driver offer', 'error')
      return
    }

    try {
      setProcessingId(shipment.id)
      await reviewDirectDriverOffer(shipment.id, {
        action,
        ...(action === 'approve' ? { driver_offer_amount: amount } : {}),
        notes: draft.notes.trim(),
      })
      toast(action === 'approve' ? 'Driver offer approved' : 'Shipment offer declined', 'success')
      await loadReviews()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to review driver offer', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Direct Driver Offers</h1>
          <p className="mt-1 text-sm text-gray-600">
            Approve an all-in payout before a shipment is visible to drivers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadReviews()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="border-y border-gray-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Offers include the driver&apos;s fuel, labor, insurance, maintenance, and tolls. Approval is blocked
            below the 30% contribution-margin floor after payment fees and the risk reserve.
          </p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="border-y border-gray-200 bg-white px-4 py-12 text-center">
          <Truck className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="font-medium text-gray-900">No direct shipments need offer review</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200 bg-white">
          {shipments.map(shipment => {
            const draft = drafts[shipment.id] || { amount: '', notes: '' }
            const proposedAmount = Number(draft.amount)
            const projectedMargin = Number.isFinite(proposedAmount) && shipment.estimated_price > 0
              ? ((
                shipment.estimated_price
                - proposedAmount
                - (
                  shipment.estimated_price * shipment.policy.paymentProcessingRate
                  + shipment.policy.paymentProcessingFixed
                )
                - shipment.estimated_price * shipment.policy.riskReserveRate
              ) / shipment.estimated_price) * 100
              : null
            const isSafe = shipment.maximumSafeDriverOffer !== null
              && Number.isFinite(proposedAmount)
              && proposedAmount > 0
              && proposedAmount <= shipment.maximumSafeDriverOffer

            return (
              <section key={shipment.id} className="p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_minmax(220px,0.7fr)_auto] xl:items-end">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{shipment.title}</h2>
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium capitalize text-gray-700">
                        {shipment.driver_offer_status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{shipment.pickup_address} to {shipment.delivery_address}</span>
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {shipment.vehicle_type || 'Vehicle'} · {shipment.distance?.toFixed(0) || 'Unknown'} miles
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500">Client price</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{currency(shipment.estimated_price)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Safe offer ≤ {currency(shipment.maximumSafeDriverOffer)}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">All-in driver offer</span>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.amount}
                        onChange={event => updateDraft(shipment.id, { amount: event.target.value })}
                        className="h-9 w-full rounded-md border border-gray-300 pl-7 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <p className={`mt-1 text-xs font-medium ${isSafe ? 'text-green-700' : 'text-red-700'}`}>
                      {projectedMargin === null ? 'Enter an offer' : `${projectedMargin.toFixed(2)}% projected margin`}
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">Review notes (optional for approval)</span>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={event => updateDraft(shipment.id, { notes: event.target.value })}
                      placeholder="Market check or decision reason"
                      className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </label>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!isSafe || processingId === shipment.id}
                      onClick={() => void submitReview(shipment, 'approve')}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === shipment.id}
                      onClick={() => void submitReview(shipment, 'decline')}
                      aria-label={`Decline offer for ${shipment.title}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}