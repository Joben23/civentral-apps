import type { WarningLevelCode } from '@/src/types/drrmWarnings';

export type WarningBadgeVariant = 'success' | 'warning' | 'danger';

export function getWarningBadgeVariant(code: WarningLevelCode): WarningBadgeVariant {
  switch (code) {
    case 'LOW':
      return 'success';
    case 'MODERATE':
      return 'warning';
    case 'HIGH':
    case 'CRITICAL':
      return 'danger';
  }
}

export function formatWarningDateTime(value: string | null): string {
  if (!value) {
    return 'Not specified';
  }

  // PHP APIs may return either ISO 8601 or a common SQL datetime string.
  const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T')
    : value;
  const parsedDate = new Date(normalizedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not specified';
  }

  return parsedDate.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
