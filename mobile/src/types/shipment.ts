import colors from '../theme/colors';

export interface Shipment {
  id: string;
  title: string;
  description?: string;
  status: ShipmentStatus;
  pickupAddress: string;
  deliveryAddress: string;
  pickupDate: string;
  deliveryDate?: string;
  userId: string;
  driverId?: string;
  createdAt: string;
  updatedAt: string;
  items?: ShipmentItem[];
  tracking?: TrackingInfo;
  price?: number;
}

export type ShipmentStatus = 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export interface ShipmentItem {
  id: string;
  name: string;
  quantity: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface TrackingInfo {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  location?: string;
  timestamp: string;
  notes?: string;
}

export const shipmentStatusMap: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const getStatusColor = (status: ShipmentStatus): string => {
  switch (status) {
    case 'pending':
      return colors.status.pending;
    case 'accepted':
      return colors.status.accepted;
    case 'picked_up':
      return colors.status.picked_up;
    case 'in_transit':
      return colors.status.in_transit;
    case 'delivered':
      return colors.status.delivered;
    case 'cancelled':
      return colors.status.cancelled;
    default:
      return colors.text.disabled;
  }
};

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(dateString: string): string {
  return `${formatDate(dateString)} at ${formatTime(dateString)}`;
}

export function getReadableAddress(address: string): string {
  // This function would parse a full address and return a more readable format
  // For now, just return the address as is
  return address;
}
