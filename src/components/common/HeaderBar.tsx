import React, { useEffect, useSyncExternalStore } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getCitizenIncidentNotifications,
  getCitizenIncidentUnreadCountSnapshot,
  subscribeToCitizenIncidentUnreadCount,
} from '@/src/services/drrmIncidentNotifications';

export interface HeaderBarProps {
  subtitle?: string;
  onNotificationPress?: () => void;
}

export function HeaderBar({
  subtitle = 'Caloocan Government Services',
  onNotificationPress,
}: HeaderBarProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 16);
  const unreadCount = useSyncExternalStore(
    subscribeToCitizenIncidentUnreadCount,
    getCitizenIncidentUnreadCountSnapshot,
    getCitizenIncidentUnreadCountSnapshot,
  );

  useEffect(() => {
    void getCitizenIncidentNotifications().catch(() => {
      // The header stays usable when the authenticated notification source is unavailable.
    });
  }, []);

  return (
    <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
      {/* Left: Logo + App Name + Subtitle */}
      <View style={styles.leftBrand}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.textStack}>
          <Text style={styles.brandTitle}>CIVENTRAL</Text>
          <Text style={styles.brandSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Right: Bell Notification with Red Badge */}
      <TouchableOpacity
        style={styles.notificationBtn}
        onPress={onNotificationPress}
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
        activeOpacity={0.7}>
        <IconSymbol name="bell.fill" size={22} color="#176B87" />
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  leftBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  textStack: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#176B87',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: -1,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
