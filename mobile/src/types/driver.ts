export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
}

export function getDriverFullName(driver: Driver): string {
  return `${driver.first_name} ${driver.last_name}`;
}

export function getDriverInitials(driver: Driver): string {
  return `${driver.first_name.charAt(0)}${driver.last_name.charAt(0)}`.toUpperCase();
}