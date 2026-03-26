/**
 * Format a date string into Danish (da-DK) locale format
 * @param dateString ISO date string (e.g., "1912-12-17T00:00:00")
 * @param options Intl.DateTimeFormatOptions - default is day, month as text, and year
 * @returns Formatted date string (e.g., "17. december 1912")
 */
export function formatDanishDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
): string {
  return new Date(dateString).toLocaleDateString("da-DK", options);
}

/**
 * Format a date string into Danish short format (dd-MM-yyyy)
 * @param dateString ISO date string (e.g., "1912-12-17T00:00:00")
 * @returns Formatted date string (e.g., "17-12-1912")
 */
export function formatDanishShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
