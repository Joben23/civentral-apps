import type { AffectedArea, WarningLevel, WarningSource } from './drrmWarnings';

export interface CitizenWarningNotification {
  notification_event_id: string;
  warning_id: string;
  title: string;
  hazard_type: string;
  hazard_label: string;
  warning_level: WarningLevel;
  summary: string;
  issued_at: string;
  valid_until: string | null;
  activated_at: string;
  source: WarningSource;
  source_reference: string | null;
  scope: string;
  affected_areas: AffectedArea[];
  is_read: boolean;
  read_at: string | null;
}

export interface CitizenWarningNotificationsResponse {
  success: true;
  city: string;
  data_as_of: string;
  count: number;
  unread_count: number;
  notifications: CitizenWarningNotification[];
}

export interface MarkCitizenWarningNotificationReadResponse {
  success: true;
  notification_event_id: string;
  is_read: true;
  read_at: string;
  already_read: boolean;
}
