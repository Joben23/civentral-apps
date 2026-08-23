import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function EmergencyDomainCard() {
  return (
    <Card variant="outlined">
      <View style={styles.header}>
        <Text style={styles.title}>Emergency, DRRM & Safety</Text>
        <Badge label="5 Citizen Modules" variant="danger" />
      </View>
      <Text style={styles.desc}>
        Emergency warnings, hazard and evacuation information, relief services, incident reporting,
        and barangay DRRM coordination for Caloocan City.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8, color: '#0F172A' },
  desc: { fontSize: 13, color: '#64748B', marginTop: 6 },
});
