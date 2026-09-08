/**
 * Centralized Date & Time utilities
 * Ensures consistent local browser timezone calculations across the entire app
 * (streak boundaries, history grouping, micro-commitment checks, letter unlocks, and digest windows).
 */

/**
 * Returns YYYY-MM-DD in the user's local timezone.
 */
export function getLocalDateKey(dateOrMillis: Date | number = new Date()): string {
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD string to the start of that day (00:00:00) in local time epoch millis.
 */
export function localDateStrToMillis(dateStr: string): number {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0).getTime();
  }
  return new Date(dateStr).getTime();
}

/**
 * Returns epoch millis for the start of today (00:00:00.000) in local timezone.
 */
export function getStartOfLocalToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Formats a timestamp into a clean, localized date and time string.
 * Example: "Sep 1, 2026, 1:28 AM"
 */
export function formatLocalDateTime(dateOrMillis?: Date | number | null): string {
  if (!dateOrMillis) return '';
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats a timestamp into a localized short time string.
 * Example: "1:28 AM"
 */
export function formatLocalTime(dateOrMillis?: Date | number | null): string {
  if (!dateOrMillis) return '';
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats a timestamp into a localized date string.
 * Example: "Sep 1, 2026"
 */
export function formatLocalDate(dateOrMillis?: Date | number | null): string {
  if (!dateOrMillis) return '';
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a timestamp into a short month-day string.
 * Example: "Sep 1"
 */
export function formatLocalMonthDay(dateOrMillis?: Date | number | null): string {
  if (!dateOrMillis) return '';
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a start and end timestamp range into a clean, localized string.
 * - If both timestamps fall on the same local calendar day, returns single date (e.g. "Sep 1, 2026"), avoiding redundant "Sep 1 – Sep 1, 2026".
 * - If spanning multiple days within the same year: "Aug 25 – Sep 1, 2026".
 * - If spanning across years: "Dec 28, 2025 – Jan 4, 2026".
 */
export function formatDateRange(startMillis?: number | null, endMillis?: number | null): string {
  if (!startMillis && !endMillis) return '';
  if (!startMillis) return formatLocalDate(endMillis);
  if (!endMillis) return formatLocalDate(startMillis);

  const startKey = getLocalDateKey(startMillis);
  const endKey = getLocalDateKey(endMillis);

  // Same calendar day
  if (startKey === endKey) {
    return formatLocalDate(startMillis);
  }

  const startDate = new Date(startMillis);
  const endDate = new Date(endMillis);

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${formatLocalMonthDay(startMillis)} – ${formatLocalDate(endMillis)}`;
  }

  return `${formatLocalDate(startMillis)} – ${formatLocalDate(endMillis)}`;
}

export type DateGroupCategory = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

/**
 * Safely extracts epoch milliseconds from any Firestore document field, Timestamp, message timestamp, or fallback.
 * CRITICAL: Never returns `Date.now()` on missing/null timestamp so historical entries are not falsely stamped as 'now'.
 */
export function parseDocTimestamp(data: any): number {
  if (!data) return 0;

  // 1. Explicitly stored numeric millisecond timestamp
  if (typeof data.createdAtMillis === 'number' && !isNaN(data.createdAtMillis) && data.createdAtMillis > 0) {
    return data.createdAtMillis;
  }

  // 2. Firestore Timestamp object (with toMillis method)
  if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
    return data.createdAt.toMillis();
  }

  // 3. Firestore Timestamp object (with toDate method)
  if (data.createdAt && typeof data.createdAt.toDate === 'function') {
    const d = data.createdAt.toDate();
    if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
  }

  // 4. Firestore Timestamp plain object ({ seconds, nanoseconds })
  if (data.createdAt && typeof data.createdAt.seconds === 'number') {
    const sec = data.createdAt.seconds;
    const nano = typeof data.createdAt.nanoseconds === 'number' ? data.createdAt.nanoseconds : 0;
    return sec * 1000 + Math.round(nano / 1000000);
  }

  // 5. Epoch number in seconds or milliseconds
  if (typeof data.createdAt === 'number' && !isNaN(data.createdAt)) {
    return data.createdAt > 1e11 ? data.createdAt : data.createdAt * 1000;
  }

  // 6. ISO Date string
  if (typeof data.createdAt === 'string') {
    const parsed = Date.parse(data.createdAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 7. Check internal messages array timestamps (each message is stamped at creation)
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    for (let i = data.messages.length - 1; i >= 0; i--) {
      const msg = data.messages[i];
      if (msg && typeof msg.timestamp === 'number' && msg.timestamp > 0) {
        return msg.timestamp;
      }
    }
  }

  // 8. Fallback to updatedAt if present
  if (data.updatedAt && typeof data.updatedAt.toMillis === 'function') {
    return data.updatedAt.toMillis();
  }
  if (data.updatedAt && typeof data.updatedAt.seconds === 'number') {
    return data.updatedAt.seconds * 1000;
  }

  return 0;
}

/**
 * Categorizes a timestamp into a friendly date group for history views.
 * Uses strict local day boundary comparisons.
 */
export function categorizeDateGroup(dateOrMillis: Date | number): DateGroupCategory {
  const d = typeof dateOrMillis === 'number' ? new Date(dateOrMillis) : dateOrMillis;
  const entryKey = getLocalDateKey(d);

  const now = new Date();
  const todayKey = getLocalDateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  if (entryKey === todayKey) {
    return 'Today';
  }
  if (entryKey === yesterdayKey) {
    return 'Yesterday';
  }

  // 7 days window (inclusive of current local week)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  if (d.getTime() >= sevenDaysAgo.getTime()) {
    return 'This Week';
  }

  return 'Earlier';
}
