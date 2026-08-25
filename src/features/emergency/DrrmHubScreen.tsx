import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Badge, type BadgeProps } from '@/src/components/ui/Badge';
import { DrrmWarningsService } from '@/src/services/drrmWarnings';
import { DRRM_HUB_MODULES, type DrrmHubModule } from './drrmModules';

type WarningCount = number | null | undefined;

function getModuleBadge(
  module: DrrmHubModule,
  warningCount: WarningCount,
): { label: string; variant: BadgeProps['variant'] } {
  if (!module.enabled) {
    return { label: 'Coming Soon', variant: 'neutral' };
  }
  if (module.id === 'hazard-map') {
    return { label: 'Available', variant: 'success' };
  }
  if (module.id === 'incident-reporting') {
    return { label: 'Available', variant: 'success' };
  }
  if (warningCount === undefined) {
    return { label: 'Checking', variant: 'neutral' };
  }
  if (warningCount === null) {
    return { label: 'View Warnings', variant: 'info' };
  }
  return {
    label: `${warningCount} Active`,
    variant: warningCount > 0 ? 'danger' : 'neutral',
  };
}

function getModuleAction(module: DrrmHubModule): string {
  if (!module.enabled) return 'Coming Soon';
  if (module.id === 'hazard-map') return 'Open Hazard Map';
  if (module.id === 'incident-reporting') return 'Report an Incident';
  return 'Open Emergency Warnings';
}

export function DrrmHubScreen() {
  const router = useRouter();
  const [warningCount, setWarningCount] = useState<WarningCount>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWarningCount = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    }

    try {
      const response = await DrrmWarningsService.getActiveWarnings();
      setWarningCount(response.active_warning_count);
    } catch {
      setWarningCount(null);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWarningCount();
  }, [loadWarningCount]);

  const openModule = (module: DrrmHubModule) => {
    if (module.enabled && module.route) {
      router.push(module.route as never);
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
            onRefresh={() => void loadWarningCount(true)}
            tintColor="#176B87"
            colors={['#176B87']}
          />
        }>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <IconSymbol name="shield.fill" size={29} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.cityLabel}>CALOOCAN CITY</Text>
            <Text style={styles.title}>Disaster Risk Reduction & Emergency Response</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Access emergency warnings, hazard information, incident reporting, relief services,
          and barangay DRRM coordination.
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DRRM Emergency Services</Text>
          <Text style={styles.sectionCount}>5 MODULES</Text>
        </View>

        <View style={styles.moduleList}>
          {DRRM_HUB_MODULES.map((module) => {
            const badge = getModuleBadge(module, warningCount);
            const hasActiveWarning = module.id === 'early-warning' && (warningCount ?? 0) > 0;

            return (
              <TouchableOpacity
                key={module.id}
                testID={`drrm-module-${module.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${module.title}. ${badge.label}`}
                accessibilityState={{ disabled: !module.enabled }}
                activeOpacity={module.enabled ? 0.84 : 1}
                disabled={!module.enabled}
                onPress={() => openModule(module)}
                style={[
                  styles.moduleCard,
                  !module.enabled && styles.disabledModuleCard,
                  hasActiveWarning && styles.activeWarningCard,
                ]}>
                <View style={styles.moduleTopRow}>
                  <View style={[styles.moduleIcon, { backgroundColor: module.iconBackground }]}>
                    <IconSymbol name={module.icon} size={23} color={module.iconColor} />
                  </View>
                  <Badge label={badge.label} variant={badge.variant} />
                </View>

                <Text style={[styles.moduleTitle, !module.enabled && styles.disabledText]}>
                  {module.title}
                </Text>
                <Text style={[styles.moduleDescription, !module.enabled && styles.disabledDescription]}>
                  {module.description}
                </Text>

                <View style={styles.moduleFooter}>
                  <Text style={[styles.moduleAction, !module.enabled && styles.disabledAction]}>
                    {getModuleAction(module)}
                  </Text>
                  {module.enabled ? (
                    <IconSymbol name="chevron.right" size={16} color="#176B87" />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.informationNote}>
          <IconSymbol name="help.circle.fill" size={18} color="#176B87" />
          <Text style={styles.informationText}>
            Only services with verified citizen access are enabled. Additional DRRM services will
            appear here when available.
          </Text>
        </View>
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
    paddingBottom: 112,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#176B87',
    borderRadius: 20,
    padding: 18,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroCopy: {
    flex: 1,
    marginLeft: 14,
  },
  cityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BAE6FD',
    letterSpacing: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 24,
    marginTop: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginTop: 13,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  moduleList: {
    gap: 12,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  disabledModuleCard: {
    backgroundColor: '#F8FAFC',
    shadowOpacity: 0,
    elevation: 0,
  },
  activeWarningCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF7F7',
  },
  moduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 21,
  },
  disabledText: {
    color: '#475569',
  },
  moduleDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 5,
  },
  disabledDescription: {
    color: '#64748B',
  },
  moduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 11,
    marginTop: 13,
  },
  moduleAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#176B87',
    marginRight: 3,
  },
  disabledAction: {
    color: '#94A3B8',
    marginRight: 0,
  },
  informationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  informationText: {
    flex: 1,
    fontSize: 11,
    color: '#0F4C61',
    lineHeight: 16,
    marginLeft: 8,
  },
});
