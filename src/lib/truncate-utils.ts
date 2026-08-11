/**
 * Utility functions for truncating IDs and emails to show only the last 7 characters
 */

/**
 * Truncates a string to show only the last 7 characters
 * @param value - The string to truncate
 * @returns The truncated string showing only the last 7 characters
 */
export function truncateToLast7(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(-7);
}
