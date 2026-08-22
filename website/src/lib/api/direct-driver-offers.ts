import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

export interface DirectDriverOfferReview {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  distance: number | null
  vehicle_type: string | null
  estimated_price: number
  status: string
  assignment_type: string | null
  driver_offer_amount: number | null
  driver_offer_status: 'pending_review' | 'approved' | 'accepted' | 'declined' | 'cancelled'
  projected_contribution_margin_percent: number | null
  maximumSafeDriverOffer: number | null
  policyVersion: 'direct-launch-v1'
  policy: {
    paymentProcessingRate: number
    paymentProcessingFixed: number
    riskReserveRate: number
    minimumContributionMarginRate: number
  }
  created_at: string
}

async function getHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || 'Driver offer request failed')
  }
  return body.data as T
}

export async function getDirectDriverOfferReviews(): Promise<DirectDriverOfferReview[]> {
  const response = await fetch(`${API_BASE_URL}/admin/direct-driver-offers/review`, {
    headers: await getHeaders(),
    cache: 'no-store',
  })
  return parseResponse<DirectDriverOfferReview[]>(response)
}

export async function reviewDirectDriverOffer(
  shipmentId: string,
  input: {
    action: 'approve' | 'decline'
    driver_offer_amount?: number
    notes?: string
  }
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/admin/direct-driver-offers/${shipmentId}`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify(input),
  })
  return parseResponse<Record<string, unknown>>(response)
}