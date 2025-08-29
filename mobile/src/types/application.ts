import { Driver } from './driver';

export interface Application {
  id: string;
  driver_id: string;
  shipment_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  applied_at: string;
  updated_at: string | null;
  driver?: Driver;
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export const applicationStatusMap: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export function getApplicationStatusLabel(status: ApplicationStatus): string {
  return applicationStatusMap[status] || status;
}