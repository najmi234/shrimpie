import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a timestamp string from the database as local time (WIB).
 *
 * Supabase returns `timestamp without time zone` values with a `+00:00`
 * suffix, which makes `new Date()` treat the already-WIB value as UTC
 * and then adds 7 hours when converting to local time.
 *
 * This helper strips the timezone offset so JavaScript interprets the
 * value as local time, preserving the original hours.
 */
export function parseDateAsLocal(dateStr: string): Date {
  // Remove trailing timezone offset (+00:00, +07:00, Z, etc.)
  const cleaned = dateStr.replace(/([+-]\d{2}(:\d{2})?|Z)$/, "")
  return new Date(cleaned)
}
