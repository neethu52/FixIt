/**
 * Date and Time utilities for FixIt
 * Accurately formats UTC timestamps to Indian Standard Time (IST) / local time.
 */

export function formatDateToIST(utcDateString?: string | null): string {
  if (!utcDateString) return '—';
  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) return utcDateString;

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return utcDateString;
  }
}

export function formatDateOnlyIST(utcDateString?: string | null): string {
  if (!utcDateString) return '—';
  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) return utcDateString;

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return utcDateString;
  }
}

/**
 * Returns YYYY-MM-DD format for date input controls.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeTime(utcDateString?: string | null): string {
  if (!utcDateString) return '—';
  try {
    const date = new Date(utcDateString);
    if (isNaN(date.getTime())) return utcDateString;

    const now = Date.now();
    const diffMs = now - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 45) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return formatDateOnlyIST(utcDateString);
  } catch {
    return utcDateString;
  }
}

export const formatRelativeTime = getRelativeTime;
