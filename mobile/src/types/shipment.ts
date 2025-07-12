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
      return '#FFB74D'; // Orange
    case 'accepted':
      return '#64B5F6'; // Light Blue
    case 'picked_up':
      return '#64B5F6'; // Light Blue
    case 'in_transit':
      return '#1E88E5'; // Blue
    case 'delivered':
      return '#81C784'; // Light Green
    case 'cancelled':
      return '#E57373'; // Light Red
    default:
      return '#9E9E9E'; // Grey
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
