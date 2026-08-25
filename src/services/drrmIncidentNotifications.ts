import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import {
  CITIZEN_INCIDENT_NOTIFICATION_STATUSES,
  type CitizenIncidentNotification,
  type CitizenIncidentNotificationsResponse,
  type CitizenIncidentNotificationStatus,
  type MarkCitizenIncidentNotificationsReadResponse,
} from '@/src/types/drrmIncidentNotifications';

const NOTIFICATIONS_PATH = '/drrm/incident-notifications.php';
const MARK_READ_PATH = '/drrm/incident-notifications-read.php';
const REQUEST_TIMEOUT_MS = 10_000;
const EVENT_ID_PATTERN = /^inc_evt_[0-9a-f]{32}$/;
const INCIDENT_NUMBER_PATTERN = /^INC-[0-9]{4}-[0-9]{6,}$/;

export const INCIDENT_NOTIFICATIONS_ERROR_MESSAGE =
  'Incident notifications could not be loaded. Please try again.';

export type DrrmIncidentNotificationsErrorCode =
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export class DrrmIncidentNotificationsError extends Error {
  constructor(public readonly code: DrrmIncidentNotificationsErrorCode) {
    super(INCIDENT_NOTIFICATIONS_ERROR_MESSAGE);
    this.name = 'DrrmIncidentNotificationsError';
  }
}

type UnknownRecord = Record<string, unknown>;
type UnreadCountListener = () => void;

let unreadCount = 0;
let notificationRequest: Promise<CitizenIncidentNotificationsResponse> | null = null;
let notificationSessionGeneration = 0;
const unreadCountListeners = new Set<UnreadCountListener>();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }
  return value.trim();
}

function readNonNegativeInteger(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }
  return value;
}

function parseNotification(value: unknown): CitizenIncidentNotification {
  if (!isRecord(value)) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  const eventId = readString(value, 'event_id');
  const incidentNumber = readString(value, 'incident_number');
  const status = readString(value, 'status');
  const occurredAt = readString(value, 'occurred_at');

  if (
    !EVENT_ID_PATTERN.test(eventId) ||
    !INCIDENT_NUMBER_PATTERN.test(incidentNumber) ||
    !CITIZEN_INCIDENT_NOTIFICATION_STATUSES.includes(
      status as CitizenIncidentNotificationStatus,
    ) ||
    Number.isNaN(Date.parse(occurredAt)) ||
    typeof value.is_read !== 'boolean'
  ) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  // Deliberately project only the backend's citizen-safe notification fields.
  return {
    event_id: eventId,
    incident_number: incidentNumber,
    title: readString(value, 'title'),
    status: status as CitizenIncidentNotificationStatus,
    status_label: readString(value, 'status_label'),
    occurred_at: occurredAt,
    message: readString(value, 'message'),
    is_read: value.is_read,
  };
}

export function parseCitizenIncidentNotificationsResponse(
  value: unknown,
): CitizenIncidentNotificationsResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    typeof value.has_more !== 'boolean' ||
    !Array.isArray(value.notifications)
  ) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  const count = readNonNegativeInteger(value, 'count');
  const responseUnreadCount = readNonNegativeInteger(value, 'unread_count');
  const notifications = value.notifications.map(parseNotification);
  const visibleUnreadCount = notifications.filter((notification) => !notification.is_read).length;

  if (count !== notifications.length || responseUnreadCount < visibleUnreadCount) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  return {
    success: true,
    unread_count: responseUnreadCount,
    count,
    has_more: value.has_more,
    notifications,
  };
}

export function parseMarkCitizenIncidentNotificationsReadResponse(
  value: unknown,
): MarkCitizenIncidentNotificationsReadResponse {
  if (!isRecord(value) || value.success !== true) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  const lastSeenAt = value.last_seen_at;
  if (
    lastSeenAt !== null &&
    (typeof lastSeenAt !== 'string' || Number.isNaN(Date.parse(lastSeenAt)))
  ) {
    throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
  }

  return {
    success: true,
    last_seen_at: lastSeenAt,
    message: readString(value, 'message'),
  };
}

function publishUnreadCount(nextUnreadCount: number): void {
  if (unreadCount === nextUnreadCount) return;
  unreadCount = nextUnreadCount;
  unreadCountListeners.forEach((listener) => listener());
}

export function getCitizenIncidentUnreadCountSnapshot(): number {
  return unreadCount;
}

export function subscribeToCitizenIncidentUnreadCount(listener: UnreadCountListener): () => void {
  unreadCountListeners.add(listener);
  return () => unreadCountListeners.delete(listener);
}

export function resetCitizenIncidentNotificationState(): void {
  notificationSessionGeneration += 1;
  notificationRequest = null;
  publishUnreadCount(0);
}

async function requestJson(path: string, options: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CITIZEN_API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DrrmIncidentNotificationsError('HTTP_ERROR');
    }

    try {
      return JSON.parse(await response.text()) as unknown;
    } catch {
      throw new DrrmIncidentNotificationsError('INVALID_RESPONSE');
    }
  } catch (error) {
    if (error instanceof DrrmIncidentNotificationsError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DrrmIncidentNotificationsError('TIMEOUT');
    }
    throw new DrrmIncidentNotificationsError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCitizenIncidentNotifications(): Promise<CitizenIncidentNotificationsResponse> {
  if (notificationRequest) return notificationRequest;

  const requestGeneration = notificationSessionGeneration;
  const currentRequest = (async () => {
    const payload = await requestJson(NOTIFICATIONS_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const response = parseCitizenIncidentNotificationsResponse(payload);
    if (requestGeneration === notificationSessionGeneration) {
      publishUnreadCount(response.unread_count);
    }
    return response;
  })();
  notificationRequest = currentRequest;

  try {
    return await currentRequest;
  } finally {
    if (notificationRequest === currentRequest) notificationRequest = null;
  }
}

export async function markCitizenIncidentNotificationsRead(): Promise<MarkCitizenIncidentNotificationsReadResponse> {
  const payload = await requestJson(MARK_READ_PATH, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const response = parseMarkCitizenIncidentNotificationsReadResponse(payload);
  publishUnreadCount(0);
  return response;
}

export const DrrmIncidentNotificationService = {
  getCitizenIncidentNotifications,
  markCitizenIncidentNotificationsRead,
};
