/**
 * SMS notification listener
 *
 * Subscribes to notificationEvents and calls the existing twilioService methods
 * for each relevant event. This ensures SMS notifications fire for mutations from
 * ALL sources (REST controllers AND Benji tool executors) with no manual calls.
 *
 * Register once at app startup via registerSmsNotificationListeners().
 */

import { notificationEvents }    from '../lib/notification-events';
import type {
  ShipmentCreatedPayload,
  DriverAssignedPayload,
  StatusUpdatedPayload,
  DeliveredPayload,
} from '../lib/notification-events';
import { logger }                from '@utils/logger';

async function lookupClientPhone(clientId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import('../lib/supabase');
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .eq('id', clientId)
      .maybeSingle();
    return (data?.phone as string | null) ?? null;
  } catch {
    return null;
  }
}

async function lookupClientPhoneByShipment(shipmentId: string): Promise<{ phone: string | null; clientId: string | null }> {
  try {
    const { supabaseAdmin } = await import('../lib/supabase');
    const { data: shipment } = await supabaseAdmin
      .from('shipments')
      .select('client_id')
      .eq('id', shipmentId)
      .maybeSingle();
    if (!shipment?.client_id) return { phone: null, clientId: null };
    const phone = await lookupClientPhone(shipment.client_id as string);
    return { phone, clientId: shipment.client_id as string };
  } catch {
    return { phone: null, clientId: null };
  }
}

export function registerSmsNotificationListeners(): void {
  // ── shipment.created ──────────────────────────────────────────────────────
  notificationEvents.on('shipment.created', async (payload: ShipmentCreatedPayload) => {
    const phone = payload.clientPhone
      ?? (payload.clientId ? await lookupClientPhone(payload.clientId) : null)
      ?? (await lookupClientPhoneByShipment(payload.shipmentId)).phone;
    if (!phone) return;
    try {
      const { twilioService } = await import('../services/twilio.service');
      await twilioService.sendShipmentNotification(
        phone,
        payload.shipmentId,
        'created',
        `https://drivedrop.us.com/dashboard/client/tracking/${payload.shipmentId}`,
      );
    } catch (err) {
      logger.error('[SMS_NOTIFICATION] shipment.created send failed', { err, shipmentId: payload.shipmentId });
    }
  });

  // ── driver.assigned ───────────────────────────────────────────────────────
  notificationEvents.on('driver.assigned', async (payload: DriverAssignedPayload) => {
    const phone = payload.clientPhone
      ?? (payload.clientId ? await lookupClientPhone(payload.clientId) : null)
      ?? (await lookupClientPhoneByShipment(payload.shipmentId)).phone;
    if (!phone) return;
    try {
      const { twilioService } = await import('../services/twilio.service');
      await twilioService.sendDriverAssignmentNotification(
        phone,
        payload.driverName  ?? 'Your driver',
        payload.driverPhone ?? '',
      );
    } catch (err) {
      logger.error('[SMS_NOTIFICATION] driver.assigned send failed', { err, shipmentId: payload.shipmentId });
    }
  });

  // ── status.updated ────────────────────────────────────────────────────────
  notificationEvents.on('status.updated', async (payload: StatusUpdatedPayload) => {
    const phone = payload.clientPhone
      ?? (payload.clientId ? await lookupClientPhone(payload.clientId) : null)
      ?? (await lookupClientPhoneByShipment(payload.shipmentId)).phone;
    if (!phone) return;
    try {
      const { twilioService } = await import('../services/twilio.service');
      await twilioService.sendShipmentNotification(phone, payload.shipmentId, payload.newStatus);
    } catch (err) {
      logger.error('[SMS_NOTIFICATION] status.updated send failed', { err, shipmentId: payload.shipmentId });
    }
  });

  // ── delivered ─────────────────────────────────────────────────────────────
  notificationEvents.on('delivered', async (payload: DeliveredPayload) => {
    const phone = payload.clientPhone
      ?? (payload.clientId ? await lookupClientPhone(payload.clientId) : null)
      ?? (await lookupClientPhoneByShipment(payload.shipmentId)).phone;
    if (!phone) return;
    try {
      const { twilioService } = await import('../services/twilio.service');
      await twilioService.sendDeliveryConfirmation(phone, payload.shipmentId, payload.deliveredAt);
    } catch (err) {
      logger.error('[SMS_NOTIFICATION] delivered send failed', { err, shipmentId: payload.shipmentId });
    }
  });

  logger.info('[SMS_NOTIFICATION] Listeners registered');
}
