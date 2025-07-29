/**
 * Formatting utility functions
 */

/**
 * Format a number as currency (USD)
 * @param value The value to format as currency
 * @returns Formatted currency string (e.g. $123.45)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format a date to a human-readable string
 * @param date The date to format
 * @returns Formatted date string (e.g. "July 29, 2025")
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a date to a human-readable time
 * @param date The date to format
 * @returns Formatted time string (e.g. "3:45 PM")
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format a date and time in a human-readable format
 * @param date The date to format
 * @returns Formatted date and time string (e.g. "July 29, 2025 at 3:45 PM")
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return `${formatDate(dateObj)} at ${formatTime(dateObj)}`;
};

/**
 * Calculate the time remaining until a deadline
 * @param deadline The deadline timestamp
 * @returns Formatted time remaining string (e.g. "59m 30s") or null if expired
 */
export const getTimeRemaining = (deadline: Date | string): string | null => {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const timeDiff = deadlineDate.getTime() - now.getTime();
  
  if (timeDiff <= 0) return null;
  
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m ${seconds}s`;
};

/**
 * Format a time duration in milliseconds to a human-readable string
 * @param ms Time in milliseconds
 * @returns Formatted time string (e.g. "1h 30m")
 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};
