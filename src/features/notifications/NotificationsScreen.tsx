import { Badge, type BadgeProps } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { WarningLevelBadge } from '@/src/features/emergency/components/WarningLevelBadge';
import { formatWarningDateTime } from '@/src/features/emergency/warningPresentation';
import { AuthService } from '@/src/services/auth-service';
import {
  DrrmIncidentNotificationService,
  INCIDENT_NOTIFICATIONS_ERROR_MESSAGE,
} from '@/src/services/drrmIncidentNotifications';
import {
  applyWarningReadReceipt,
  DrrmWarningNotificationsError,
  DrrmWarningNotificationService,
  resetCitizenWarningNotificationState,
  WARNING_NOTIFICATIONS_ERROR_MESSAGE,
} from '@/src/services/drrmWarningNotifications';
import type {
  CitizenIncidentNotification,
  CitizenIncidentNotificationStatus,
} from '@/src/types/drrmIncidentNotifications';
import type {
  CitizenWarningNotification,
  CitizenWarningNotificationsResponse,
} from '@/src/types/drrmWarningNotifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
        <Text style={styles.stateBody}>Updates about your reported incidents will appear here.</Text>
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
      accessibilityLabel={notification.title + ', ' + notification.status_label + ', '
        + (notification.is_read ? 'read' : 'unread')}>
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

interface WarningContentProps {
  feed: CitizenWarningNotificationsResponse | null;
  isLoading: boolean;
  loadError: string | null;
  markReadError: string | null;
  openingEventId: string | null;
  onRetry: () => void;
  onOpen: (notification: CitizenWarningNotification) => void;
}

function WarningContent({
  feed,
  isLoading,
  loadError,
  markReadError,
  openingEventId,
  onRetry,
  onOpen,
}: WarningContentProps) {
  if (isLoading) {
    return (
      <View style={styles.loadingBox} testID={'warning-notifications-loading-state'}>
        <ActivityIndicator size={'small'} color={'#176B87'} />
        <Text style={styles.loadingText}>Loading active warning notifications...</Text>
      </View>
    );
  }

  if (loadError || !feed) {
    return (
      <View style={styles.stateCard} testID={'warning-notifications-error-state'}>
        <Text style={styles.stateTitle}>Warning notifications unavailable</Text>
        <Text style={styles.stateBody}>
          {loadError || WARNING_NOTIFICATIONS_ERROR_MESSAGE}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (feed.notifications.length === 0) {
    return (
      <View style={styles.stateCard} testID={'warning-notifications-empty-state'}>
        <Text style={styles.stateTitle}>No active warning notifications</Text>
        <Text style={styles.stateBody}>Pull down to check for newly activated warnings.</Text>
      </View>
    );
  }

  return (
    <View style={styles.alertsStack} testID={'warning-notifications-list'}>
      {markReadError ? <Text style={styles.inlineErrorText}>{markReadError}</Text> : null}
      {feed.notifications.map((notification) => (
        <TouchableOpacity
          key={notification.notification_event_id}
          testID={'warning-notification-' + notification.notification_event_id}
          accessibilityRole="button"
          accessibilityLabel={'Open warning: ' + notification.title + ', '
            + (notification.is_read ? 'read' : 'unread')}
          disabled={openingEventId !== null}
          activeOpacity={0.84}
          onPress={() => onOpen(notification)}>
          <Card
            variant="outlined"
            style={[styles.warningAlertCard, !notification.is_read && styles.unreadWarningCard]}>
            <View style={styles.alertTopRow}>
              <Badge
                label={notification.is_read ? 'READ' : 'UNREAD'}
                variant={notification.is_read ? 'neutral' : 'info'}
              />
              <Text style={styles.timestampText}>
                Activated {formatWarningDateTime(notification.activated_at)}
              </Text>
            </View>
            <Text style={styles.alertTitle}>{notification.title}</Text>
            <Text style={styles.warningHazardLabel}>{notification.hazard_label}</Text>
            <WarningLevelBadge level={notification.warning_level} />
            <Text style={styles.alertBody}>{notification.summary}</Text>
            <Text style={styles.warningAreaText}>
              Affected areas: {notification.affected_areas.length > 0
                ? notification.affected_areas.map((area) => area.name).join(', ')
                : 'No specific affected areas provided'}
            </Text>
            {openingEventId === notification.notification_event_id ? (
              <ActivityIndicator size="small" color="#176B87" />
            ) : null}
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SignInNotificationsState({ expired }: { expired: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Notifications & Alerts</Text>
        </View>
        <View
          style={styles.stateCard}
          testID={expired
            ? 'warning-notifications-session-expired-state'
            : 'warning-notifications-sign-in-state'}>
          <Text style={styles.stateTitle}>{expired ? 'Session expired' : 'Sign in required'}</Text>
          <Text style={styles.stateBody}>
            {expired
              ? 'Your session has expired. Sign in again to view your warning notifications.'
              : 'Sign in to view your warning notifications and incident updates.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            accessibilityRole="button"
            onPress={() => router.push('/(auth)' as never)}>
            <Text style={styles.retryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function AuthenticatedNotificationsContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<CitizenIncidentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markReadError, setMarkReadError] = useState<string | null>(null);
  const [shouldMarkRead, setShouldMarkRead] = useState(false);
  const [warningFeed, setWarningFeed] = useState<CitizenWarningNotificationsResponse | null>(null);
  const [isWarningLoading, setIsWarningLoading] = useState(true);
  const [warningLoadError, setWarningLoadError] = useState<string | null>(null);
  const [warningMarkReadError, setWarningMarkReadError] = useState<string | null>(null);
  const [openingEventId, setOpeningEventId] = useState<string | null>(null);
  const lastAutomaticWarningFetchAt = useRef(0);
  const warningRevision = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!AuthService.isCitizenAuthenticated()) return;
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

  const fetchWarnings = useCallback(async () => {
    if (!AuthService.isCitizenAuthenticated()) return;
    lastAutomaticWarningFetchAt.current = Date.now();
    const revision = warningRevision.current;
    setIsWarningLoading(true);
    setWarningLoadError(null);
    try {
      const response = await DrrmWarningNotificationService.getCitizenWarningNotifications();
      if (revision !== warningRevision.current) return;
      setWarningFeed(response);
      setWarningMarkReadError(null);
    } catch (error) {
      if (error instanceof DrrmWarningNotificationsError && error.code === 'AUTH_REQUIRED') {
        AuthService.clearCurrentUser('expired');
        return;
      }
      if (error instanceof DrrmWarningNotificationsError && error.code === 'SESSION_CHANGED') {
        return;
      }
      if (revision !== warningRevision.current) return;
      setWarningFeed(null);
      setWarningLoadError(
        error instanceof DrrmWarningNotificationsError && error.code === 'FORBIDDEN'
          ? 'Access to warning notifications was denied for this session.'
          : WARNING_NOTIFICATIONS_ERROR_MESSAGE,
      );
    } finally {
      if (revision === warningRevision.current) setIsWarningLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchWarnings();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastAutomaticWarningFetchAt.current >= 15_000) {
        void fetchWarnings();
      }
    });
    return () => subscription.remove();
  }, [fetchWarnings]));

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
    try {
      await Promise.all([fetchWarnings(), fetchNotifications()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleIncidentRetry = async () => {
    setIsLoading(true);
    await fetchNotifications();
    setIsLoading(false);
  };

  const handleWarningOpen = async (notification: CitizenWarningNotification) => {
    if (openingEventId !== null || !AuthService.isCitizenAuthenticated()) return;
    if (!notification.is_read) {
      setOpeningEventId(notification.notification_event_id);
      setWarningMarkReadError(null);
      try {
        const receipt = await DrrmWarningNotificationService.markCitizenWarningNotificationRead(
          notification.notification_event_id,
        );
        warningRevision.current += 1;
        setWarningFeed((current) => current ? applyWarningReadReceipt(current, receipt) : null);
      } catch (error) {
        if (error instanceof DrrmWarningNotificationsError && error.code === 'AUTH_REQUIRED') {
          AuthService.clearCurrentUser('expired');
          return;
        }
        if (error instanceof DrrmWarningNotificationsError && error.code === 'SESSION_CHANGED') {
          return;
        }
        if (error instanceof DrrmWarningNotificationsError && error.code === 'NOT_ELIGIBLE') {
          warningRevision.current += 1;
          resetCitizenWarningNotificationState();
          setWarningFeed(null);
          await fetchWarnings();
          return;
        }
        setWarningMarkReadError(
          error instanceof DrrmWarningNotificationsError && error.code === 'FORBIDDEN'
            ? 'Read access was denied. The warning remains unread.'
            : 'Read status could not be saved. The warning remains unread.',
        );
      } finally {
        setOpeningEventId(null);
      }
    }
    if (AuthService.isCitizenAuthenticated()) {
      router.push(('/emergency/' + encodeURIComponent(notification.warning_id)) as never);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={'#176B87'}
          />
        }>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Notifications & Alerts</Text>
          <Text style={styles.headerSubtitle}>
            Active warnings and updates about your reported incidents.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVE WARNING NOTIFICATIONS</Text>
          {warningFeed && warningFeed.unread_count > 0 ? (
            <Text style={styles.unreadSummary}>
              {warningFeed.unread_count} unread
            </Text>
          ) : null}
        </View>
        <WarningContent
          feed={warningFeed}
          isLoading={isWarningLoading}
          loadError={warningLoadError}
          markReadError={warningMarkReadError}
          openingEventId={openingEventId}
          onRetry={() => void fetchWarnings()}
          onOpen={(notification) => void handleWarningOpen(notification)}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>INCIDENT UPDATES</Text>
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
          onRetry={() => void handleIncidentRetry()}
        />
      </ScrollView>
    </View>
  );
}

export function NotificationsScreen() {
  const sessionRevision = useSyncExternalStore(
    AuthService.subscribeCitizenSession,
    AuthService.getCitizenSessionRevisionSnapshot,
    AuthService.getCitizenSessionRevisionSnapshot,
  );
  if (!AuthService.isCitizenAuthenticated()) {
    return <SignInNotificationsState expired={AuthService.getSessionEndReason() === 'expired'} />;
  }
  return <AuthenticatedNotificationsContent key={sessionRevision} />;
}
const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  warningAlertCard: {
    marginVertical: 0,
    gap: 8,
  },
  unreadWarningCard: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  warningHazardLabel: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  warningAreaText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
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
