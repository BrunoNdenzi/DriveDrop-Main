// Type definitions for DriveDrop Mobile
declare namespace DriveDrop {
  type Role = 'client' | 'driver' | 'admin';
  
  interface WithRoleCheckProps {
    allowedRoles: Role[];
    redirectTo?: string;
  }
  
  interface AuthenticatedScreenProps {
    requiresAuth: boolean;
  }
}
