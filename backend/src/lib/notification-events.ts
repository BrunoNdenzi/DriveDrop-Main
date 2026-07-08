/**
 * Lightweight notification event bus.
 *
 * Emitted by:
 *   - Benji V4 tool executors (execCreateShipment, execAssignDriver, execUpdateShipmentStatus)
 *   - REST shipment controller (updateShipmentStatus)
 *
 * Consumed by:
 *   - sms-notification.listener.ts (calls twilioService methods)
 *
 * Do NOT import the old benji/core/events/ scaffolding — it's unused and dead.
 */

import { EventEmitter } from 'node:events';

export const notificationEvents = new EventEmitter();

// Increase limit slightly from the default 10 to avoid Node warnings
notificationEvents.setMaxListeners(20);

export type NotificationEventName =
  | 'shipment.created'
  | 'driver.assigned'
  | 'status.updated'
  | 'delivered';

export interface ShipmentCreatedPayload {
  shipmentId:   string;
  clientId:     string;
  clientPhone?: string;
}

export interface DriverAssignedPayload {
  shipmentId:   string;
  clientId:     string;
  driverId:     string;
  clientPhone?: string;
  driverName?:  string;
  driverPhone?: string;
}

export interface StatusUpdatedPayload {
  shipmentId:   string;
  newStatus:    string;
  clientId?:    string;
  clientPhone?: string;
}

export interface DeliveredPayload {
  shipmentId:   string;
  clientId?:    string;
  clientPhone?: string;
  deliveredAt:  string;
}
