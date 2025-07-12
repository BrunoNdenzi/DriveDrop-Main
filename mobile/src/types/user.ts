export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'customer' | 'driver' | 'admin';

export function getFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

export function getInitials(user: User): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'customer':
      return 'Customer';
    case 'driver':
      return 'Driver';
    case 'admin':
      return 'Administrator';
    default:
      return role;
  }
}
