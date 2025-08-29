export * from './user';
export * from './shipment';
export type Driver = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
};

export type Application = {
  id: string;
  driver_id: string;
  shipment_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  applied_at: string;
  updated_at: string | null;
  driver?: Driver;
};

export type Shipment = {
  id: string;
  title: string;
  description?: string;
  pickup_address?: string;
  delivery_address?: string;
  status?: string;
  created_at?: string;
  client_id?: string;
  driver_id?: string | null;
  estimated_price?: number;
  applications?: Application[];
  expandedApplications?: boolean;
};

export type Assignment = Shipment; // alias if you prefer