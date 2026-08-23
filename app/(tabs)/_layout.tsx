import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { HeaderBar } from '@/src/components/common/HeaderBar';
import { CustomTabBar } from '@/src/components/navigation/CustomTabBar';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: () => (
          <HeaderBar
            subtitle="Caloocan Government Services"
            onNotificationPress={() => router.push('/(tabs)/notifications')}
          />
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'DRRM',
          tabBarAccessibilityLabel: 'Open DRRM Emergency Hub',
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
        }}
      />
    </Tabs>
  );
}
