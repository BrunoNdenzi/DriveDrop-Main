import { Driver } from './driver';
import { Shipment } from './shipment';

export interface Assignment {
  id: string;
  shipment_id: string;
  driver_id: string;
  assigned_at: string;
  assigned_by: string;
  status: 'active' | 'completed' | 'cancelled';
  shipment?: Shipment;
  driver?: Driver;
}

export type AssignmentStatus = 'active' | 'completed' | 'cancelled';

export const assignmentStatusMap: Record<AssignmentStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function getAssignmentStatusLabel(status: AssignmentStatus): string {
  return assignmentStatusMap[status] || status;
}