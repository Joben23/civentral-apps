import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import type { WarningLevelCode } from '@/src/types/drrmWarnings';
import type {
  CitizenWarningNotification,
  CitizenWarningNotificationsResponse,
  MarkCitizenWarningNotificationReadResponse,
} from '@/src/types/drrmWarningNotifications';

const FEED_PATH = '/drrm/warning-notifications.php';
const MARK_READ_PATH = '/drrm/warning-notifications-read.php';
const REQUEST_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WARNING_LEVEL_CODES: WarningLevelCode[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

export const WARNING_NOTIFICATIONS_ERROR_MESSAGE =
  'Warning notifications are temporarily unavailable. Please try again.';

export type DrrmWarningNotificationsErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_ELIGIBLE'
  | 'HTTP_ERROR'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SESSION_CHANGED';

export class DrrmWarningNotificationsError extends Error {
  constructor(public readonly code: DrrmWarningNotificationsErrorCode) {
    super(WARNING_NOTIFICATIONS_ERROR_MESSAGE);
    this.name = 'DrrmWarningNotificationsError';
  }
}

type UnknownRecord = Record<string, unknown>;

let sessionGeneration = 0;
let pendingFeed: Promise<CitizenWarningNotificationsResponse> | null = null;
const activeControllers = new Set<AbortController>();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
  throw new DrrmWarningNotificationsError('INVALID_RESPONSE');
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') invalidResponse();
  return value.trim();
}

function readTimestamp(record: UnknownRecord, key: string): string {
  const value = readString(record, key);
  if (Number.isNaN(Date.parse(value))) invalidResponse();
  return value;
}

function readNullableString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') invalidResponse();
  return value;
}

function readNullableTimestamp(record: UnknownRecord, key: string): string | null {
  const value = readNullableString(record, key);
  if (value !== null && Number.isNaN(Date.parse(value))) invalidResponse();
  return value;
}

function readCount(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) invalidResponse();
  return value;
}

function readUuid(record: UnknownRecord, key: string): string {
  const value = readString(record, key);
  if (!UUID_PATTERN.test(value)) invalidResponse();
  return value.toLowerCase();
}

function parseNotification(value: unknown): CitizenWarningNotification {
  if (!isRecord(value) || !isRecord(value.warning_level) || !isRecord(value.source)
    || !Array.isArray(value.affected_areas) || typeof value.is_read !== 'boolean') {
    invalidResponse();
  }

  const levelCode = readString(value.warning_level, 'code');
  if (!WARNING_LEVEL_CODES.includes(levelCode as WarningLevelCode)
    || readString(value.warning_level, 'scale') !== 'CIVENTRAL Warning Level') {
    invalidResponse();
  }
  const readAt = readNullableTimestamp(value, 'read_at');
  if (value.is_read !== (readAt !== null)) invalidResponse();

  return {
    notification_event_id: readUuid(value, 'notification_event_id'),
    warning_id: readUuid(value, 'warning_id'),
    title: readString(value, 'title'),
    hazard_type: readString(value, 'hazard_type'),
    hazard_label: readString(value, 'hazard_label'),
    warning_level: {
      code: levelCode as WarningLevelCode,
      label: readString(value.warning_level, 'label'),
      scale: 'CIVENTRAL Warning Level',
    },
    summary: readString(value, 'summary'),
    issued_at: readTimestamp(value, 'issued_at'),
    valid_until: readNullableTimestamp(value, 'valid_until'),
    activated_at: readTimestamp(value, 'activated_at'),
    source: {
      code: readString(value.source, 'code'),
      name: readString(value.source, 'name'),
    },
    source_reference: readNullableString(value, 'source_reference'),
    scope: readString(value, 'scope'),
    affected_areas: value.affected_areas.map((area: unknown) => {
      if (!isRecord(area)) invalidResponse();
      return { scope: readString(area, 'scope'), name: readString(area, 'name') };
    }),
    is_read: value.is_read,
    read_at: readAt,
  };
}

export function parseCitizenWarningNotificationsResponse(
  value: unknown,
): CitizenWarningNotificationsResponse {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.notifications)) {
    invalidResponse();
  }
  const notifications = value.notifications.map(parseNotification);
  const count = readCount(value, 'count');
  const unreadCount = readCount(value, 'unread_count');
  if (count !== notifications.length
    || unreadCount !== notifications.filter((item) => !item.is_read).length
    || new Set(notifications.map((item) => item.notification_event_id)).size !== count) {
    invalidResponse();
  }
  const city = readString(value, 'city');
  if (city !== 'Caloocan City') invalidResponse();
  return {
    success: true,
    city,
    data_as_of: readTimestamp(value, 'data_as_of'),
    count,
    unread_count: unreadCount,
    notifications,
  };
}

export function parseMarkCitizenWarningNotificationReadResponse(
  value: unknown,
  eventId: string,
): MarkCitizenWarningNotificationReadResponse {
  if (!isRecord(value) || value.success !== true || value.is_read !== true
    || typeof value.already_read !== 'boolean') {
    invalidResponse();
  }
  const responseEventId = readUuid(value, 'notification_event_id');
  if (responseEventId !== eventId.toLowerCase()) invalidResponse();
  return {
    success: true,
    notification_event_id: responseEventId,
    is_read: true,
    read_at: readTimestamp(value, 'read_at'),
    already_read: value.already_read,
  };
}

async function requestJson(path: string, options: RequestInit, generation: number): Promise<unknown> {
  if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
  const controller = new AbortController();
  activeControllers.add(controller);
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CITIZEN_API_BASE_URL + path, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
    if (!response.ok) {
      const code: DrrmWarningNotificationsErrorCode = response.status === 401
        ? 'AUTH_REQUIRED'
        : response.status === 403
          ? 'FORBIDDEN'
          : response.status === 409
            ? 'NOT_ELIGIBLE'
            : 'HTTP_ERROR';
      throw new DrrmWarningNotificationsError(code);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      invalidResponse();
    }
    if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
    return payload;
  } catch (error) {
    if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
    if (error instanceof DrrmWarningNotificationsError) throw error;
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      throw new DrrmWarningNotificationsError('TIMEOUT');
    }
    throw new DrrmWarningNotificationsError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
    activeControllers.delete(controller);
  }
}

export function resetCitizenWarningNotificationState(): void {
  sessionGeneration += 1;
  pendingFeed = null;
  activeControllers.forEach((controller) => controller.abort());
  activeControllers.clear();
}

export async function getCitizenWarningNotifications(): Promise<CitizenWarningNotificationsResponse> {
  if (pendingFeed) return pendingFeed;
  const generation = sessionGeneration;
  const request = (async () => {
    const payload = await requestJson(FEED_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, generation);
    const parsed = parseCitizenWarningNotificationsResponse(payload);
    if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
    return parsed;
  })();
  pendingFeed = request;
  try {
    return await request;
  } finally {
    if (pendingFeed === request) pendingFeed = null;
  }
}

export async function markCitizenWarningNotificationRead(
  notificationEventId: string,
): Promise<MarkCitizenWarningNotificationReadResponse> {
  if (!UUID_PATTERN.test(notificationEventId)) {
    throw new DrrmWarningNotificationsError('INVALID_REQUEST');
  }
  const generation = sessionGeneration;
  const payload = await requestJson(MARK_READ_PATH, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_event_id: notificationEventId.toLowerCase() }),
  }, generation);
  const parsed = parseMarkCitizenWarningNotificationReadResponse(payload, notificationEventId);
  if (generation !== sessionGeneration) throw new DrrmWarningNotificationsError('SESSION_CHANGED');
  return parsed;
}

export function applyWarningReadReceipt(
  feed: CitizenWarningNotificationsResponse,
  receipt: MarkCitizenWarningNotificationReadResponse,
): CitizenWarningNotificationsResponse {
  const notifications = feed.notifications.map((item) => item.notification_event_id === receipt.notification_event_id
    ? { ...item, is_read: true, read_at: receipt.read_at }
    : item);
  return {
    ...feed,
    notifications,
    unread_count: notifications.filter((item) => !item.is_read).length,
  };
}

export const DrrmWarningNotificationService = {
  getCitizenWarningNotifications,
  markCitizenWarningNotificationRead,
};
