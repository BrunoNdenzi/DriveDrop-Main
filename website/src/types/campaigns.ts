// Copied & extended from backend/src/types/campaigns.types.ts

export interface FMCSACarrierData {
  dotNumber: string
  companyName: string
  mcNumber?: string
  address: string
  city: string
  state: string
  zip: string
  phone?: string
  powerUnits?: number
  drivers?: number
  operatingStatus: string
}

export interface EnrichedCarrier extends FMCSACarrierData {
  id: string
  email?: string
  emailVerified: boolean
  emailScore?: number
  website?: string
  source: 'hunter' | 'apollo' | 'snov' | 'manual'
  enrichedAt: Date
}

export interface TargetAudience {
  states?: string[]
  minPowerUnits?: number
  maxPowerUnits?: number
  businessType?: 'carrier' | 'broker'
  emailVerified?: boolean
}

export interface Campaign {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent?: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'cancelled'
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  targetAudience?: TargetAudience
  totalRecipients: number
  dailyLimit: number
  sendRatePerHour: number
  warmupMode: boolean
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  unsubscribedCount: number
  conversionCount: number
  createdBy: string
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CampaignStats {
  totalRecipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
  conversions: number
  openRate: number
  clickRate: number
  bounceRate: number
  conversionRate: number
}

export interface CampaignRecipient {
  id: string
  campaignId: string
  carrierContactId: string
  email: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'unsubscribed'
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  bouncedAt?: string
  openCount: number
  clickCount: number
  lastOpenedAt?: string
  lastClickedAt?: string
  errorMessage?: string
  bounceType?: string
  createdAt: string
  updatedAt: string
  carrier_contacts?: { company_name: string; state: string; email: string }
}

export interface CarrierContact {
  id: string
  dotNumber: string
  dot_number: string
  companyName: string
  company_name: string
  mcNumber?: string
  mc_number?: string
  email?: string
  emailVerified: boolean
  email_verified: boolean
  emailVerificationScore: number
  email_verification_score: number
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  businessType?: string
  business_type?: string
  powerUnits?: number
  power_units?: number
  drivers?: number
  operatingStatus?: string
  operating_status?: string
  source?: string
  enrichedAt?: string
  enriched_at?: string
  lastVerifiedAt?: string
  last_verified_at?: string
  createdAt: string
  created_at: string
  updatedAt: string
  updated_at: string
}

// Analytics types
export interface AnalyticsOverview {
  total: number
  byStatus: Record<string, number>
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
  openRate: number
  clickRate: number
  bounceRate: number
}

export interface TimeSeriesPoint {
  date: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}

export interface GeoDataPoint {
  state: string
  sent: number
  opened: number
  clicked: number
  openRate: number
}

export interface DeviceDataPoint {
  deviceType: string
  opens: number
  clicks: number
  percentage: number
}

export interface FunnelStep {
  stage: string
  count: number
  rate: number
}

export interface LeaderboardEntry extends CampaignStats {
  campaignId: string
  campaignName: string
  status: string
  createdAt: string
}

export interface CampaignPerformance extends CampaignStats {
  campaignId: string
  campaignName: string
  status: string
  warmupMode: boolean
  startedAt?: string
  completedAt?: string
  durationHours?: number
}
