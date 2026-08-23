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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ACTIVE_WARNINGS_ERROR_MESSAGE, DrrmWarningsService } from '@/src/services/drrmWarnings';
import type { ActiveWarningsResponse, CitizenWarning } from '@/src/types/drrmWarnings';
import { WarningLevelBadge } from './components/WarningLevelBadge';
import { formatWarningDateTime } from './warningPresentation';

function affectedAreaNames(warning: CitizenWarning): string {
  const names = warning.affected_areas.map((area) => area.name);
  return names.length > 0 ? names.join(', ') : 'No specific affected areas provided';
}

export function ActiveWarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<ActiveWarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWarnings = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await DrrmWarningsService.getActiveWarnings();
      setData(response);
    } catch {
      setErrorMessage(ACTIVE_WARNINGS_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWarnings();
  }, [loadWarnings]);

  const openWarning = (warning: CitizenWarning) => {
    router.push(`/emergency/${encodeURIComponent(warning.id)}` as never);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadWarnings(true)}
            tintColor="#176B87"
            colors={['#176B87']}
          />
        }>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CALOOCAN CITY</Text>
            <Text style={styles.title}>Emergency Alerts</Text>
            <Text style={styles.subtitle}>Active public warnings from CIVENTRAL DRRM</Text>
          </View>
          <View style={styles.warningIconCircle}>
            <IconSymbol name="exclamationmark.triangle.fill" size={25} color="#B91C1C" />
          </View>
        </View>

        {isLoading && !data ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#176B87" />
            <Text style={styles.stateTitle}>Loading emergency warnings</Text>
            <Text style={styles.stateText}>Checking current information for Caloocan City.</Text>
          </View>
        ) : null}

        {!isLoading && errorMessage && !data ? (
          <View style={styles.stateCard}>
            <View style={styles.errorIconCircle}>
              <IconSymbol name="exclamationmark.triangle.fill" size={22} color="#B91C1C" />
            </View>
            <Text style={styles.stateTitle}>Warnings unavailable</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <Text style={styles.stateHint}>The rest of CIVENTRAL remains available.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void loadWarnings()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.countCard}>
              <View>
                <Text style={styles.countLabel}>ACTIVE WARNING COUNT</Text>
                <Text style={styles.countValue}>{data.active_warning_count}</Text>
              </View>
              <View style={styles.countMeta}>
                <Text style={styles.countCity}>{data.city}</Text>
                <Text style={styles.asOfText}>As of {formatWarningDateTime(data.data_as_of)}</Text>
              </View>
            </View>

            {errorMessage ? (
              <View style={styles.inlineError}>
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#B45309" />
                <Text style={styles.inlineErrorText}>
                  Refresh failed. Showing the last loaded warning information.
                </Text>
              </View>
            ) : null}

            {data.warnings.length === 0 ? (
              <View style={styles.stateCard}>
                <View style={styles.emptyIconCircle}>
                  <IconSymbol name="shield.fill" size={24} color="#15803D" />
                </View>
                <Text style={styles.stateTitle}>No active warnings</Text>
                <Text style={styles.stateText}>No active emergency warnings for Caloocan City.</Text>
                <Text style={styles.stateHint}>Pull down to check again.</Text>
              </View>
            ) : (
              <View style={styles.warningList}>
                {data.warnings.map((warning) => (
                  <TouchableOpacity
                    key={warning.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open warning: ${warning.title}`}
                    activeOpacity={0.84}
                    style={styles.warningCard}
                    onPress={() => openWarning(warning)}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.hazardLabel}>{warning.hazard_label}</Text>
                      <Text style={styles.activeLabel}>ACTIVE WARNING</Text>
                    </View>

                    <Text style={styles.warningTitle}>{warning.title}</Text>
                    <WarningLevelBadge level={warning.warning_level} />

                    <View style={styles.metaBlock}>
                      <View style={styles.metaRow}>
                        <IconSymbol name="location.fill" size={15} color="#64748B" />
                        <Text style={styles.metaText}>{affectedAreaNames(warning)}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <IconSymbol name="bell.fill" size={15} color="#64748B" />
                        <Text style={styles.metaText}>Issued {formatWarningDateTime(warning.issued_at)}</Text>
                      </View>
                      {warning.valid_until ? (
                        <View style={styles.metaRow}>
                          <IconSymbol name="checkmark.seal.fill" size={15} color="#64748B" />
                          <Text style={styles.metaText}>
                            Valid until {formatWarningDateTime(warning.valid_until)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.summary} numberOfLines={3}>{warning.summary}</Text>

                    <View style={styles.cardFooter}>
                      <Text style={styles.openText}>View Warning Details</Text>
                      <IconSymbol name="chevron.right" size={16} color="#176B87" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 112 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headingCopy: { flex: 1, marginRight: 16 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#B91C1C', letterSpacing: 1.1 },
  title: { fontSize: 23, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  warningIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  countCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  countLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.8 },
  countValue: { fontSize: 32, fontWeight: '900', color: '#B91C1C', marginTop: 1 },
  countMeta: { alignItems: 'flex-end', flex: 1, marginLeft: 16 },
  countCity: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  asOfText: { fontSize: 10, color: '#64748B', marginTop: 3, textAlign: 'right' },
  stateCard: { minHeight: 230, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  stateTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 12 },
  stateText: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 19, marginTop: 5 },
  stateHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 6 },
  emptyIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  errorIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  retryButton: { marginTop: 16, borderRadius: 10, backgroundColor: '#176B87', paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  inlineError: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginBottom: 14 },
  inlineErrorText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16, marginLeft: 8 },
  warningList: { gap: 12 },
  warningCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  hazardLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' },
  activeLabel: { fontSize: 9, fontWeight: '800', color: '#15803D', letterSpacing: 0.5 },
  warningTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', lineHeight: 22, marginVertical: 9 },
  metaBlock: { gap: 7, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start' },
  metaText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16, marginLeft: 7 },
  summary: { fontSize: 13, color: '#334155', lineHeight: 19, marginTop: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 14, paddingTop: 11 },
  openText: { fontSize: 12, fontWeight: '800', color: '#176B87', marginRight: 3 },
});

