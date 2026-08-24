import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a timestamp string from the database as a Date object.
 *
 * Safely parses ISO 8601 strings with timezone indicators (Z, +00:00, etc.)
 * as well as plain local date strings without causing double timezone offsets.
 */
export function parseDateAsLocal(dateStr: string): Date {
  if (!dateStr) return new Date()
  // If dateStr has explicit timezone offset or Z suffix, use native Date parsing
  if (/[Zz]|\d{2}:\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
  }
  // Remove trailing timezone offset for plain strings
  const cleaned = dateStr.replace(/([+-]\d{2}(:\d{2})?|Z)$/, "")
  const parsed = new Date(cleaned)
  return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed
}
