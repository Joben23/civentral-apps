import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, type BadgeProps } from '@/src/components/ui/Badge';
import {
  DrrmIncidentNotificationService,
  INCIDENT_NOTIFICATIONS_ERROR_MESSAGE,
} from '@/src/services/drrmIncidentNotifications';
import type {
  CitizenIncidentNotification,
  CitizenIncidentNotificationStatus,
} from '@/src/types/drrmIncidentNotifications';
import { formatIncidentNotificationTime } from './notificationPresentation';

function getStatusBadgeVariant(
  status: CitizenIncidentNotificationStatus,
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'RESPONDING':
    case 'ASSIGNED':
      return 'warning';
    default:
      return 'info';
  }
}

interface NotificationContentProps {
  notifications: CitizenIncidentNotification[];
  isLoading: boolean;
  loadError: string | null;
  markReadError: string | null;
  hasMore: boolean;
  onRetry: () => void;
}

function NotificationContent({
  notifications,
  isLoading,
  loadError,
  markReadError,
  hasMore,
  onRetry,
}: NotificationContentProps) {
  if (isLoading) {
    return (
      <View style={styles.loadingBox} testID={'notifications-loading-state'}>
        <ActivityIndicator size={'small'} color={'#176B87'} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  if (loadError && notifications.length === 0) {
    return (
      <View style={styles.stateCard} testID={'notifications-error-state'}>
        <Text style={styles.stateTitle}>Notifications unavailable</Text>
        <Text style={styles.stateBody}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.stateCard} testID={'notifications-empty-state'}>
        <Text style={styles.stateTitle}>No notifications yet</Text>
        <Text style={styles.stateBody}>
          Updates about your reported incidents and other connected CIVENTRAL services will appear
          here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.alertsStack} testID={'incident-notifications-list'}>
      {loadError ? <Text style={styles.inlineErrorText}>{loadError}</Text> : null}
      {markReadError ? <Text style={styles.inlineErrorText}>{markReadError}</Text> : null}
      {notifications.map((item) => (
        <NotificationCard key={item.event_id} notification={item} />
      ))}
      {hasMore ? <Text style={styles.limitNotice}>Showing your latest incident updates.</Text> : null}
    </View>
  );
}

function NotificationCard({ notification }: { notification: CitizenIncidentNotification }) {
  return (
    <View
      style={[styles.alertCard, !notification.is_read && styles.unreadAlertCard]}
      accessibilityLabel={`${notification.title}, ${notification.status_label}, ${
        notification.is_read ? 'read' : 'unread'
      }`}>
      <View style={styles.alertTopRow}>
        <Badge label={'DRRM INCIDENT UPDATE'} variant={'info'} />
        <Text style={styles.timestampText}>
          {formatIncidentNotificationTime(notification.occurred_at)}
        </Text>
      </View>
      <Text style={styles.alertTitle}>{notification.title}</Text>
      <View style={styles.incidentMetaRow}>
        <Text style={styles.incidentNumber}>{notification.incident_number}</Text>
        <Badge
          label={notification.status_label}
          variant={getStatusBadgeVariant(notification.status)}
        />
      </View>
      <Text style={styles.alertBody}>{notification.message}</Text>
    </View>
  );
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<CitizenIncidentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markReadError, setMarkReadError] = useState<string | null>(null);
  const [shouldMarkRead, setShouldMarkRead] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await DrrmIncidentNotificationService.getCitizenIncidentNotifications();
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
      setHasMore(response.has_more);
      setLoadError(null);
      setMarkReadError(null);
      if (response.unread_count > 0) setShouldMarkRead(true);
    } catch {
      setLoadError(INCIDENT_NOTIFICATIONS_ERROR_MESSAGE);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load(): Promise<void> {
      await fetchNotifications();
      if (isMounted) setIsLoading(false);
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!shouldMarkRead) return;
    let isMounted = true;
    async function markRead(): Promise<void> {
      try {
        await DrrmIncidentNotificationService.markCitizenIncidentNotificationsRead();
        if (!isMounted) return;
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, is_read: true })),
        );
        setUnreadCount(0);
        setMarkReadError(null);
      } catch {
        if (isMounted) {
          setMarkReadError(
            'Unread status could not be updated. Your notifications are still available.',
          );
        }
      } finally {
        if (isMounted) setShouldMarkRead(false);
      }
    }
    void markRead();
    return () => {
      isMounted = false;
    };
  }, [shouldMarkRead]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotifications();
    setIsRefreshing(false);
  };

  const handleRetry = async () => {
    setIsLoading(true);
    await fetchNotifications();
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={'#176B87'}
          />
        }>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Notifications & Alerts</Text>
          <Text style={styles.headerSubtitle}>
            Secure in-app updates about your reported incidents.
          </Text>
          {unreadCount > 0 ? (
            <Text style={styles.unreadSummary}>
              {unreadCount} unread {unreadCount === 1 ? 'update' : 'updates'}
            </Text>
          ) : null}
        </View>

        <NotificationContent
          notifications={notifications}
          isLoading={isLoading && !isRefreshing}
          loadError={loadError}
          markReadError={markReadError}
          hasMore={hasMore}
          onRetry={handleRetry}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  unreadSummary: {
    color: '#176B87',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#176B87',
    fontWeight: '600',
  },
  stateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  stateTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#176B87',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  alertsStack: {
    gap: 12,
  },
  inlineErrorText: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 10,
    borderWidth: 1,
    color: '#9A3412',
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadAlertCard: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  timestampText: {
    fontSize: 11,
    color: '#64748B',
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  incidentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  incidentNumber: {
    color: '#176B87',
    fontSize: 12,
    fontWeight: '800',
  },
  alertBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  limitNotice: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
});
