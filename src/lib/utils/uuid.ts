/**
 * UUID validation utility
 */

/**
 * UUID validation regex pattern (RFC 4122)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}
