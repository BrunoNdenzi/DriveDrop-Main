// =====================================================
// BROKER SERVICE LAYER
// Supabase client functions for broker operations
// =====================================================

import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import type {
  BrokerProfile,
  CreateBrokerProfile,
  UpdateBrokerProfile,
  BrokerCarrier,
  CreateBrokerCarrier,
  UpdateBrokerCarrier,
  BrokerAssignment,
  CreateBrokerAssignment,
  UpdateBrokerAssignment,
  LoadBoard,
  CreateLoadBoard,
  UpdateLoadBoard,
  LoadBoardBid,
  CreateLoadBoardBid,
  UpdateLoadBoardBid,
  BrokerPayout,
  CreateBrokerPayout,
  UpdateBrokerPayout,
  BrokerDocument,
  CreateBrokerDocument,
  UpdateBrokerDocument,
  BrokerStatsResponse,
  LoadBoardFilters,
  PaymentDistribution,
} from '@/types/broker';

// =====================================================
// BROKER PROFILES
// =====================================================

export const brokerProfileService = {
  /**
   * Get broker profile by profile_id (user ID)
   */
  async getByProfileId(profileId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_profiles')
      .select('*, profile:profiles(*)')
      .eq('profile_id', profileId)
      .single();

    if (error) throw error;
    return data as BrokerProfile;
  },

  /**
   * Get broker profile by broker profile ID
   */
  async getById(brokerId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_profiles')
      .select('*, profile:profiles(*)')
      .eq('id', brokerId)
      .single();

    if (error) throw error;
    return data as BrokerProfile;
  },

  /**
   * Get all broker profiles (admin only)
   */
  async getAll(filters?: {
    verification_status?: string;
    account_status?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('broker_profiles')
      .select('*, profile:profiles(*)', { count: 'exact' });

    if (filters?.verification_status) {
      query = query.eq('verification_status', filters.verification_status);
    }
    if (filters?.account_status) {
      query = query.eq('account_status', filters.account_status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as BrokerProfile[], count };
  },

  /**
   * Create new broker profile
   */
  async create(profile: CreateBrokerProfile) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerProfile;
  },

  /**
   * Update broker profile
   */
  async update(brokerId: string, updates: UpdateBrokerProfile) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_profiles')
      .update(updates)
      .eq('id', brokerId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerProfile;
  },

  /**
   * Update verification status
   */
  async updateVerification(
    brokerId: string,
    status: string,
    notes?: string
  ) {
    const supabase = getSupabaseBrowserClient();
    const updates: any = {
      verification_status: status,
      verification_notes: notes,
    };

    if (status === 'verified') {
      updates.verified_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('broker_profiles')
      .update(updates)
      .eq('id', brokerId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerProfile;
  },

  /**
   * Get broker statistics
   */
  async getStats(brokerId: string): Promise<BrokerStatsResponse> {
    const supabase = getSupabaseBrowserClient();

    // Get broker profile
    const { data: broker, error: brokerError } = await supabase
      .from('broker_profiles')
      .select('*')
      .eq('id', brokerId)
      .single();

    if (brokerError) throw brokerError;

    // Get active shipments count
    const { count: activeShipments, error: activeError } = await supabase
      .from('broker_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('broker_id', brokerId)
      .in('assignment_status', ['pending', 'accepted', 'in_progress']);

    if (activeError) throw activeError;

    // Get pending payouts sum
    const { data: payouts, error: payoutsError } = await supabase
      .from('broker_payouts')
      .select('payout_amount')
      .eq('broker_id', brokerId)
      .eq('payout_status', 'pending');

    if (payoutsError) throw payoutsError;

    const pendingPayouts = payouts?.reduce((sum: number, p: any) => sum + p.payout_amount, 0) || 0;

    return {
      total_shipments: broker.total_shipments_completed,
      active_shipments: activeShipments || 0,
      total_revenue: broker.total_revenue_generated,
      pending_payouts: pendingPayouts,
      total_carriers: broker.total_carriers,
      active_carriers: broker.active_carriers,
      average_rating: broker.average_rating,
      on_time_rate: broker.on_time_delivery_rate,
    };
  },
};

// =====================================================
// BROKER CARRIERS (Driver Network)
// =====================================================

export const brokerCarrierService = {
  /**
   * Get all carriers for a broker
   */
  async getByBrokerId(brokerId: string, status?: string) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('broker_carriers')
      .select('*, carrier:profiles!carrier_id(*)')
      .eq('broker_id', brokerId);

    if (status) {
      query = query.eq('relationship_status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as BrokerCarrier[];
  },

  /**
   * Get specific broker-carrier relationship
   */
  async getRelationship(brokerId: string, carrierId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_carriers')
      .select('*')
      .eq('broker_id', brokerId)
      .eq('carrier_id', carrierId)
      .single();

    if (error) throw error;
    return data as BrokerCarrier;
  },

  /**
   * Invite a carrier to broker network
   */
  async invite(invitation: CreateBrokerCarrier) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_carriers')
      .insert(invitation)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerCarrier;
  },

  /**
   * Accept carrier invitation
   */
  async acceptInvitation(relationshipId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_carriers')
      .update({
        relationship_status: 'active',
        invitation_accepted_at: new Date().toISOString(),
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerCarrier;
  },

  /**
   * Update carrier relationship
   */
  async update(relationshipId: string, updates: UpdateBrokerCarrier) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_carriers')
      .update(updates)
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerCarrier;
  },

  /**
   * Terminate carrier relationship
   */
  async terminate(relationshipId: string, reason?: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_carriers')
      .update({
        relationship_status: 'terminated',
        termination_reason: reason,
        terminated_at: new Date().toISOString(),
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerCarrier;
  },
};

// =====================================================
// LOAD BOARD
// =====================================================

export const loadBoardService = {
  /**
   * Get available loads (for brokers)
   */
  async getAvailableLoads(filters?: LoadBoardFilters) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('load_board')
      .select(`
        *,
        shipment:shipments(*),
        posted_by_user:profiles!posted_by(*)
      `)
      .eq('load_status', 'available');

    // Apply filters if provided
    if (filters?.pickup_state) {
      query = query.filter('shipment.pickup_state', 'eq', filters.pickup_state);
    }
    if (filters?.delivery_state) {
      query = query.filter('shipment.delivery_state', 'eq', filters.delivery_state);
    }
    if (filters?.vehicle_type) {
      query = query.filter('shipment.vehicle_type', 'eq', filters.vehicle_type);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoadBoard[];
  },

  /**
   * Get load by ID
   */
  async getById(loadId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board')
      .select(`
        *,
        shipment:shipments(*),
        posted_by_user:profiles!posted_by(*),
        bids:load_board_bids(*)
      `)
      .eq('id', loadId)
      .single();

    if (error) throw error;
    return data as LoadBoard;
  },

  /**
   * Post shipment to load board
   */
  async postLoad(load: CreateLoadBoard) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board')
      .insert(load)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoard;
  },

  /**
   * Update load
   */
  async update(loadId: string, updates: UpdateLoadBoard) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board')
      .update(updates)
      .eq('id', loadId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoard;
  },

  /**
   * Cancel load
   */
  async cancel(loadId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board')
      .update({ load_status: 'cancelled' })
      .eq('id', loadId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoard;
  },

  /**
   * Assign load to broker/carrier
   */
  async assignLoad(loadId: string, brokerId: string, carrierId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board')
      .update({
        load_status: 'assigned',
        assigned_to_broker_id: brokerId,
        assigned_to_carrier_id: carrierId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', loadId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoard;
  },
};

// =====================================================
// LOAD BOARD BIDS
// =====================================================

export const loadBoardBidService = {
  /**
   * Get all bids for a load
   */
  async getByLoadId(loadId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board_bids')
      .select(`
        *,
        broker:broker_profiles(*),
        carrier:profiles!carrier_id(*)
      `)
      .eq('load_board_id', loadId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoadBoardBid[];
  },

  /**
   * Get broker's bids
   */
  async getByBrokerId(brokerId: string, status?: string) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('load_board_bids')
      .select(`
        *,
        load_board:load_board(*),
        carrier:profiles!carrier_id(*)
      `)
      .eq('broker_id', brokerId);

    if (status) {
      query = query.eq('bid_status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoadBoardBid[];
  },

  /**
   * Place a bid
   */
  async placeBid(bid: CreateLoadBoardBid) {
    const supabase = getSupabaseBrowserClient();

    // Calculate platform fee (10%)
    const platformFee = bid.total_cost * 0.1;

    const bidData = {
      ...bid,
      platform_fee: platformFee,
    };

    const { data, error } = await supabase
      .from('load_board_bids')
      .insert(bidData)
      .select()
      .single();

    if (error) throw error;

    // Update load board total_bids count
    await supabase.rpc('increment', {
      table_name: 'load_board',
      row_id: bid.load_board_id,
      column_name: 'total_bids',
    });

    return data as LoadBoardBid;
  },

  /**
   * Accept a bid
   */
  async acceptBid(bidId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board_bids')
      .update({
        bid_status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', bidId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoardBid;
  },

  /**
   * Reject a bid
   */
  async rejectBid(bidId: string, reason?: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board_bids')
      .update({
        bid_status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', bidId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoardBid;
  },

  /**
   * Withdraw a bid
   */
  async withdrawBid(bidId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('load_board_bids')
      .update({
        bid_status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
      })
      .eq('id', bidId)
      .select()
      .single();

    if (error) throw error;
    return data as LoadBoardBid;
  },
};

// =====================================================
// BROKER ASSIGNMENTS
// =====================================================

export const brokerAssignmentService = {
  /**
   * Get assignments by broker
   */
  async getByBrokerId(brokerId: string, status?: string) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('broker_assignments')
      .select(`
        *,
        shipment:shipments(*),
        carrier:profiles!carrier_id(*)
      `)
      .eq('broker_id', brokerId);

    if (status) {
      query = query.eq('assignment_status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as BrokerAssignment[];
  },

  /**
   * Get assignment by shipment
   */
  async getByShipmentId(shipmentId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_assignments')
      .select(`
        *,
        broker:broker_profiles(*),
        carrier:profiles!carrier_id(*)
      `)
      .eq('shipment_id', shipmentId)
      .single();

    if (error) throw error;
    return data as BrokerAssignment;
  },

  /**
   * Create assignment
   */
  async create(assignment: CreateBrokerAssignment) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_assignments')
      .insert(assignment)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerAssignment;
  },

  /**
   * Update assignment status
   */
  async updateStatus(assignmentId: string, status: string) {
    const supabase = getSupabaseBrowserClient();
    const updates: any = { assignment_status: status };

    if (status === 'accepted') {
      updates.accepted_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('broker_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerAssignment;
  },

  /**
   * Cancel assignment
   */
  async cancel(assignmentId: string, reason?: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_assignments')
      .update({
        assignment_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerAssignment;
  },
};

// =====================================================
// BROKER PAYOUTS
// =====================================================

export const brokerPayoutService = {
  /**
   * Get payouts by broker
   */
  async getByBrokerId(brokerId: string, status?: string) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('broker_payouts')
      .select(`
        *,
        shipment:shipments(*)
      `)
      .eq('broker_id', brokerId);

    if (status) {
      query = query.eq('payout_status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as BrokerPayout[];
  },

  /**
   * Create payout
   */
  async create(payout: CreateBrokerPayout) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_payouts')
      .insert(payout)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerPayout;
  },

  /**
   * Update payout status
   */
  async updateStatus(payoutId: string, status: string, transactionId?: string) {
    const supabase = getSupabaseBrowserClient();
    const updates: any = { payout_status: status };

    if (status === 'processing') {
      updates.processed_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (status === 'failed') {
      updates.failed_at = new Date().toISOString();
    }

    if (transactionId) {
      updates.transaction_id = transactionId;
    }

    const { data, error } = await supabase
      .from('broker_payouts')
      .update(updates)
      .eq('id', payoutId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerPayout;
  },
};

// =====================================================
// BROKER DOCUMENTS
// =====================================================

export const brokerDocumentService = {
  /**
   * Get documents by broker
   */
  async getByBrokerId(brokerId: string, documentType?: string) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('broker_documents')
      .select('*')
      .eq('broker_id', brokerId);

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data as BrokerDocument[];
  },

  /**
   * Upload document
   */
  async upload(document: CreateBrokerDocument) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('broker_documents')
      .insert(document)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerDocument;
  },

  /**
   * Update document verification status
   */
  async updateVerification(
    documentId: string,
    status: string,
    verifiedBy?: string,
    rejectionReason?: string
  ) {
    const supabase = getSupabaseBrowserClient();
    const updates: any = {
      verification_status: status,
      verified_by: verifiedBy,
    };

    if (status === 'approved') {
      updates.verified_at = new Date().toISOString();
    } else if (status === 'rejected') {
      updates.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('broker_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data as BrokerDocument;
  },

  /**
   * Delete document
   */
  async delete(documentId: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('broker_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  /**
   * Get expiring documents
   */
  async getExpiringDocuments(brokerId?: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('check_expired_documents');

    if (error) throw error;

    if (brokerId) {
      return data.filter((doc: any) => doc.broker_id === brokerId);
    }

    return data;
  },
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate payment distribution using database function
 */
export async function calculatePaymentDistribution(
  totalAmount: number,
  brokerCommissionRate: number,
  platformFeeRate: number
): Promise<PaymentDistribution> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc('calculate_payment_distribution', {
    p_total_amount: totalAmount,
    p_broker_commission_rate: brokerCommissionRate,
    p_platform_fee_rate: platformFeeRate,
  });

  if (error) throw error;
  return data as PaymentDistribution;
}

