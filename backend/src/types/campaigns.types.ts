export interface FMCSACarrierData {
  dotNumber: string;
  companyName: string;
  mcNumber?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  powerUnits?: number;
  drivers?: number;
  operatingStatus: string;
}

export interface EnrichedCarrier extends FMCSACarrierData {
  id: string;
  email?: string;
  emailVerified: boolean;
  emailScore?: number;
  website?: string;
  source: 'hunter' | 'apollo' | 'snov' | 'manual';
  enrichedAt: Date;
}

export interface TargetAudience {
  states?: string[];
  minPowerUnits?: number;
  maxPowerUnits?: number;
  businessType?: 'carrier' | 'broker';
  emailVerified?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'cancelled';
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  targetAudience?: TargetAudience;
  totalRecipients: number;
  dailyLimit: number;
  sendRatePerHour: number;
  warmupMode: boolean;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  conversionCount: number;
  createdBy: string;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  conversionRate: number;
}

export interface EmailEvent {
  id: string;
  campaignId: string;
  recipientId: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed';
  ipAddress?: string;
  userAgent?: string;
  location?: { city?: string; region?: string; country?: string };
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  linkUrl?: string;
  linkLabel?: string;
  eventTime: Date;
  metadata?: Record<string, any>;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  carrierContactId: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'unsubscribed';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  openCount: number;
  clickCount: number;
  lastOpenedAt?: Date;
  lastClickedAt?: Date;
  errorMessage?: string;
  bounceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CarrierContact {
  id: string;
  dotNumber: string;
  companyName: string;
  mcNumber?: string;
  email?: string;
  emailVerified: boolean;
  emailVerificationScore: number;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  businessType?: string;
  powerUnits?: number;
  drivers?: number;
  operatingStatus?: string;
  source?: string;
  enrichedAt?: Date;
  lastVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrevoWebhookEvent {
  event: string;
  email: string;
  id?: number;
  date?: string;
  ts?: number;
  'message-id'?: string;
  subject?: string;
  tag?: string;
  sending_ip?: string;
  ts_epoch?: number;
  template_id?: number;
  tags?: string[];
  link?: string;
  reason?: string;
  camp_id?: number;
}
