import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * StandaloneTabBar — identical pill design to CustomTabBar,
 * but uses useRouter/usePathname instead of Tabs navigator props.
 * Used by department layout screens (education, health, etc.)
 * that live outside (tabs)/ but still need the nav bar.
 */

const TAB_ITEMS = [
  { route: '/(tabs)/', icon: 'house.fill', label: 'Home' },
  { route: '/(tabs)/services', icon: 'square.grid.2x2.fill', label: 'Services' },
  { route: '/emergency', icon: 'shield.fill', label: 'DRRM', isSOS: true },
  { route: '/(tabs)/tracker', icon: 'doc.text.fill', label: 'Transaction' },
  { route: '/(tabs)/profile', icon: 'person.crop.circle.fill', label: 'Profile' },
] as const;

export function StandaloneTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TAB_ITEMS.map((item) => {
        const isSOS = 'isSOS' in item && item.isSOS;

        if (isSOS) {
          return (
            <TouchableOpacity
              key={item.route}
              accessibilityRole="button"
              accessibilityLabel="Open DRRM Emergency Hub"
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
              style={styles.sosButtonContainer}>
              <View style={styles.sosCircle}>
                <IconSymbol name={item.icon as any} size={30} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        }

        // Consider tab active if pathname starts with the tab root
        const isActive = item.label === 'Home'
          ? pathname === '/'
          : pathname.startsWith(item.route.replace('/(tabs)', ''));

        const color = isActive ? '#176B87' : '#94A3B8';

        return (
          <TouchableOpacity
            key={item.route}
            accessibilityRole="button"
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
            style={styles.tabItem}>
            <IconSymbol name={item.icon as any} size={22} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    height: 60,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  sosButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  sosCircle: {
    position: 'absolute',
    top: -34,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
});
