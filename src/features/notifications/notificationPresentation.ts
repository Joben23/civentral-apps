export function formatIncidentNotificationTime(
  occurredAt: string,
  now: Date = new Date(),
): string {
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) return '';

  const differenceMs = Math.max(0, now.getTime() - occurred.getTime());
  const differenceMinutes = Math.floor(differenceMs / 60_000);
  if (differenceMinutes < 1) return 'Just now';
  if (differenceMinutes < 60) {
    return `${differenceMinutes} ${differenceMinutes === 1 ? 'min' : 'mins'} ago`;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (occurred >= startOfToday) {
    const differenceHours = Math.floor(differenceMs / 3_600_000);
    return `${differenceHours} ${differenceHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (occurred >= startOfYesterday) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(occurred);
}
