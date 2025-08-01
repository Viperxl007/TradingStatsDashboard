/**
 * Date utility functions to handle timezone issues consistently across the application.
 * 
 * The main issue: JavaScript's new Date("YYYY-MM-DD") interprets the string as midnight UTC,
 * which when converted to local timezone can show as the previous day.
 * 
 * Solution: Always parse dates in local timezone context.
 */

/**
 * Safely parse a date string in local timezone context
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object interpreted in local timezone
 */
export const parseLocalDate = (dateString: string): Date => {
  if (!dateString) {
    return new Date();
  }
  
  // Split the date string and create date in local timezone
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Month is 0-indexed in JavaScript Date constructor
  return new Date(year, month - 1, day);
};

/**
 * Format a date for display consistently
 * @param dateString - Date string in YYYY-MM-DD format or Date object
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string
 */
export const formatDisplayDate = (
  dateString: string | Date, 
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
): string => {
  if (!dateString) return '-';
  
  const date = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
  return date.toLocaleDateString('en-US', options);
};

/**
 * Format a date for short display (e.g., "Dec 6")
 * @param dateString - Date string in YYYY-MM-DD format or Date object
 * @returns Short formatted date string
 */
export const formatShortDate = (dateString: string | Date): string => {
  return formatDisplayDate(dateString, {
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Calculate days between two dates
 * @param fromDate - Start date (string or Date)
 * @param toDate - End date (string or Date), defaults to now
 * @returns Number of days between dates
 */
export const daysBetween = (fromDate: string | Date, toDate: string | Date = new Date()): number => {
  let from: Date;
  let to: Date;
  
  // Handle fromDate
  if (typeof fromDate === 'string') {
    from = parseLocalDate(fromDate);
  } else if (fromDate instanceof Date) {
    from = fromDate;
  } else {
    // Handle case where fromDate might be a timestamp or other format
    from = new Date(fromDate);
  }
  
  // Handle toDate
  if (typeof toDate === 'string') {
    to = parseLocalDate(toDate);
  } else if (toDate instanceof Date) {
    to = toDate;
  } else {
    to = new Date(toDate);
  }
  
  const diffTime = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a date is in the past
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if date is in the past
 */
export const isDateInPast = (dateString: string): boolean => {
  if (!dateString) return false;
  
  const date = parseLocalDate(dateString);
  const now = new Date();
  
  // Set time to start of day for accurate comparison
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  return date < now;
};

/**
 * Get current date in YYYY-MM-DD format
 * @returns Current date string
 */
export const getCurrentDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Check if an option has expired considering market hours
 * Options expire at market close (4:00 PM EST) on expiration day
 * @param expirationDateString - Expiration date string in YYYY-MM-DD format
 * @returns True if option has expired (past market close on expiration day)
 */
export const hasOptionExpired = (expirationDateString: string): boolean => {
  if (!expirationDateString) return false;
  
  // Get current time in Eastern Time (market timezone)
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  
  // Parse expiration date in local context (should be YYYY-MM-DD format)
  const [year, month, day] = expirationDateString.split('-').map(Number);
  const expirationDate = new Date(year, month - 1, day); // month is 0-indexed
  
  // Get today's date in Eastern Time
  const todayEastern = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate());
  const expirationDateOnly = new Date(expirationDate.getFullYear(), expirationDate.getMonth(), expirationDate.getDate());
  
  // If expiration date is in the future, option hasn't expired
  if (expirationDateOnly > todayEastern) {
    return false;
  }
  
  // If expiration date is in the past, option has expired
  if (expirationDateOnly < todayEastern) {
    return true;
  }
  
  // If expiration date is today, check if it's past market close (4:00 PM EST)
  if (expirationDateOnly.getTime() === todayEastern.getTime()) {
    const currentHour = easternTime.getHours();
    return currentHour >= 16; // 4:00 PM EST or later
  }
  
  // Default fallback
  return false;
};

/**
 * Convert Date object to YYYY-MM-DD string
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export const dateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};