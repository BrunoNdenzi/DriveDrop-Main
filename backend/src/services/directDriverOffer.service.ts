import { supabaseAdmin } from '@lib/supabase';
import { createError } from '@utils/error';

const PAYMENT_PROCESSING_RATE = 0.029;
const PAYMENT_PROCESSING_FIXED = 0.30;
const RISK_RESERVE_RATE = 0.02;
const MINIMUM_CONTRIBUTION_MARGIN_RATE = 0.30;

export interface DirectDriverOfferEvaluation {
  clientPrice: number;
  driverOfferAmount: number;
  maximumSafeDriverOffer: number;
  paymentProcessingCost: number;
  riskReserveAmount: number;
  projectedContributionAmount: number;
  projectedContributionMarginPercent: number;
  safe: boolean;
  policyVersion: 'direct-launch-v1';
  policy: DirectDriverOfferPolicy;
}

export interface DirectDriverOfferPolicy {
  paymentProcessingRate: number;
  paymentProcessingFixed: number;
  riskReserveRate: number;
  minimumContributionMarginRate: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyFloor(value: number): number {
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

export class DirectDriverOfferService {
  private readonly policy: DirectDriverOfferPolicy = {
    paymentProcessingRate: PAYMENT_PROCESSING_RATE,
    paymentProcessingFixed: PAYMENT_PROCESSING_FIXED,
    riskReserveRate: RISK_RESERVE_RATE,
    minimumContributionMarginRate: MINIMUM_CONTRIBUTION_MARGIN_RATE,
  };

  evaluate(clientPrice: number, driverOfferAmount: number): DirectDriverOfferEvaluation {
    if (!Number.isFinite(clientPrice) || clientPrice <= 0) {
      throw createError('A positive client price is required', 400, 'INVALID_CLIENT_PRICE');
    }
    if (!Number.isFinite(driverOfferAmount) || driverOfferAmount <= 0) {
      throw createError('A positive driver offer is required', 400, 'INVALID_DRIVER_OFFER');
    }

    const paymentProcessingCost = money(
      clientPrice * PAYMENT_PROCESSING_RATE + PAYMENT_PROCESSING_FIXED
    );
    const riskReserveAmount = money(clientPrice * RISK_RESERVE_RATE);
    const projectedContributionAmount = money(
      clientPrice - driverOfferAmount - paymentProcessingCost - riskReserveAmount
    );
    const projectedContributionMarginPercent = money(
      (projectedContributionAmount / clientPrice) * 100
    );
    const maximumSafeDriverOffer = moneyFloor(
      clientPrice
        - paymentProcessingCost
        - riskReserveAmount
        - clientPrice * MINIMUM_CONTRIBUTION_MARGIN_RATE
    );

    return {
      clientPrice: money(clientPrice),
      driverOfferAmount: money(driverOfferAmount),
      maximumSafeDriverOffer,
      paymentProcessingCost,
      riskReserveAmount,
      projectedContributionAmount,
      projectedContributionMarginPercent,
      safe: driverOfferAmount <= maximumSafeDriverOffer,
      policyVersion: 'direct-launch-v1',
      policy: this.policy,
    };
  }

  async approve(
    shipmentId: string,
    driverOfferAmount: number,
    adminId: string,
    notes: string
  ): Promise<Record<string, unknown>> {
    const shipment = await this.getReviewableShipment(shipmentId);
    const clientPrice = Number(shipment['estimated_price']);
    const evaluation = this.evaluate(clientPrice, driverOfferAmount);

    if (!evaluation.safe) {
      throw createError(
        `Driver offer exceeds the safe maximum of $${evaluation.maximumSafeDriverOffer.toFixed(2)}`,
        422,
        'UNSAFE_DRIVER_OFFER'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({
        driver_offer_amount: evaluation.driverOfferAmount,
        driver_offer_status: 'approved',
        driver_offer_reviewed_at: new Date().toISOString(),
        driver_offer_reviewed_by: adminId,
        driver_offer_review_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)
      .is('driver_id', null)
      .select(`
        id,
        estimated_price,
        assignment_type,
        driver_offer_amount,
        driver_offer_status,
        driver_offer_reviewed_at,
        driver_offer_reviewed_by,
        driver_offer_review_notes,
        payment_processing_cost,
        risk_reserve_amount,
        projected_contribution_amount,
        projected_contribution_margin_percent,
        direct_pricing_policy_snapshot
      `)
      .single();

    if (error) {
      throw createError(error.message, 400, 'DRIVER_OFFER_APPROVAL_FAILED');
    }

    return { ...data, evaluation };
  }

  async decline(shipmentId: string, adminId: string, notes: string): Promise<Record<string, unknown>> {
    await this.getReviewableShipment(shipmentId);

    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({
        driver_offer_amount: null,
        driver_offer_status: 'declined',
        driver_offer_reviewed_at: new Date().toISOString(),
        driver_offer_reviewed_by: adminId,
        driver_offer_review_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)
      .is('driver_id', null)
      .select('id, estimated_price, assignment_type, driver_offer_status, driver_offer_reviewed_at, driver_offer_reviewed_by, driver_offer_review_notes')
      .single();

    if (error) {
      throw createError(error.message, 400, 'DRIVER_OFFER_DECLINE_FAILED');
    }

    return data;
  }

  async getReviewQueue(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select(`
        id,
        title,
        pickup_address,
        delivery_address,
        distance,
        vehicle_type,
        estimated_price,
        status,
        assignment_type,
        driver_offer_amount,
        driver_offer_status,
        projected_contribution_margin_percent,
        created_at
      `)
      .is('driver_id', null)
      .in('status', ['pending', 'open'])
      .in('driver_offer_status', ['pending_review', 'declined'])
      .or('assignment_type.eq.direct,assignment_type.is.null')
      .order('created_at', { ascending: true });

    if (error) {
      throw createError(error.message, 500, 'DRIVER_OFFER_QUEUE_FAILED');
    }

    return (data || []).map((shipment: Record<string, unknown>) => {
      const clientPrice = Number(shipment['estimated_price']);
      const maximumSafeDriverOffer = Number.isFinite(clientPrice) && clientPrice > 0
        ? moneyFloor(
          clientPrice
            - money(clientPrice * PAYMENT_PROCESSING_RATE + PAYMENT_PROCESSING_FIXED)
            - money(clientPrice * RISK_RESERVE_RATE)
            - clientPrice * MINIMUM_CONTRIBUTION_MARGIN_RATE
        )
        : null;

      return {
        ...shipment,
        maximumSafeDriverOffer,
        policyVersion: 'direct-launch-v1',
        policy: this.policy,
      };
    });
  }

  private async getReviewableShipment(shipmentId: string): Promise<Record<string, unknown>> {
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select('id, estimated_price, assignment_type, status, driver_id')
      .eq('id', shipmentId)
      .maybeSingle();

    if (error) {
      throw createError(error.message, 500, 'SHIPMENT_LOOKUP_FAILED');
    }
    if (!data) {
      throw createError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
    }
    if (data.driver_id) {
      throw createError('Cannot change the offer after driver assignment', 409, 'SHIPMENT_ASSIGNED');
    }
    if ((data.assignment_type || 'direct') !== 'direct') {
      throw createError('Driver offers are only available for direct shipments', 409, 'NOT_DIRECT_SHIPMENT');
    }
    if (!['pending', 'open'].includes(data.status)) {
      throw createError('Shipment is not available for offer review', 409, 'SHIPMENT_NOT_REVIEWABLE');
    }

    return data as Record<string, unknown>;
  }
}

export const directDriverOfferService = new DirectDriverOfferService();