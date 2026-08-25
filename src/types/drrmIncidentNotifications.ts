export const CITIZEN_INCIDENT_NOTIFICATION_STATUSES = [
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'RESPONDING',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;

export type CitizenIncidentNotificationStatus =
  (typeof CITIZEN_INCIDENT_NOTIFICATION_STATUSES)[number];

export interface CitizenIncidentNotification {
  event_id: string;
  incident_number: string;
  title: string;
  status: CitizenIncidentNotificationStatus;
  status_label: string;
  occurred_at: string;
  message: string;
  is_read: boolean;
}

export interface CitizenIncidentNotificationsResponse {
  success: true;
  unread_count: number;
  count: number;
  has_more: boolean;
  notifications: CitizenIncidentNotification[];
}

export interface MarkCitizenIncidentNotificationsReadResponse {
  success: true;
  last_seen_at: string | null;
  message: string;
}
