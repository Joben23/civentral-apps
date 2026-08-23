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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Badge } from '@/src/components/ui/Badge';
import { ACTIVE_WARNINGS_ERROR_MESSAGE, DrrmWarningsService } from '@/src/services/drrmWarnings';
import type { CitizenWarning } from '@/src/types/drrmWarnings';
import { WarningLevelBadge } from './components/WarningLevelBadge';
import { formatWarningDateTime } from './warningPresentation';

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function WarningDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ warningId?: string | string[] }>();
  const warningId = Array.isArray(params.warningId) ? params.warningId[0] : params.warningId;
  const [warning, setWarning] = useState<CitizenWarning | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadWarning = useCallback(async (refreshing = false) => {
    if (!warningId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    setNotFound(false);

    try {
      const response = await DrrmWarningsService.getActiveWarnings();
      const activeWarning = response.warnings.find((item) => item.id === warningId) ?? null;
      setWarning(activeWarning);
      setNotFound(activeWarning === null);
    } catch {
      setErrorMessage(ACTIVE_WARNINGS_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [warningId]);

  useEffect(() => {
    void loadWarning();
  }, [loadWarning]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadWarning(true)}
            tintColor="#176B87"
            colors={['#176B87']}
          />
        }>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to emergency alerts"
          style={styles.backButton}
          onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Emergency Alerts</Text>
        </TouchableOpacity>

        {isLoading && !warning ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#176B87" />
            <Text style={styles.stateTitle}>Loading warning details</Text>
          </View>
        ) : null}

        {!isLoading && errorMessage && !warning ? (
          <View style={styles.stateCard}>
            <IconSymbol name="exclamationmark.triangle.fill" size={28} color="#B91C1C" />
            <Text style={styles.stateTitle}>Warning unavailable</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void loadWarning()}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isLoading && notFound && !errorMessage ? (
          <View style={styles.stateCard}>
            <IconSymbol name="shield.fill" size={28} color="#64748B" />
            <Text style={styles.stateTitle}>Warning no longer active</Text>
            <Text style={styles.stateText}>
              This warning is no longer in the active warning feed. It may have expired or been withdrawn.
            </Text>
          </View>
        ) : null}

        {warning ? (
          <>
            {errorMessage ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>
                  Refresh failed. Showing the last loaded warning details.
                </Text>
              </View>
            ) : null}

            <View style={styles.heroCard}>
              <View style={styles.statusRow}>
                <Badge label="Active Warning" variant="danger" />
                <Text style={styles.cityText}>CALOOCAN CITY</Text>
              </View>
              <Text style={styles.hazard}>{warning.hazard_label}</Text>
              <Text style={styles.title}>{warning.title}</Text>
              <WarningLevelBadge level={warning.warning_level} />
              <Text style={styles.contextText}>CIVENTRAL DRRM warning for Caloocan City</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Warning Summary</Text>
              <Text style={styles.summary}>{warning.summary}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Affected Areas</Text>
              {warning.affected_areas.length > 0 ? (
                warning.affected_areas.map((area, index) => (
                  <View key={`${area.scope}-${area.name}-${index}`} style={styles.areaRow}>
                    <IconSymbol name="location.fill" size={17} color="#B91C1C" />
                    <View style={styles.areaCopy}>
                      <Text style={styles.areaName}>{area.name}</Text>
                      <Text style={styles.areaScope}>{area.scope}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>No specific affected areas were provided.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Warning Information</Text>
              <DetailRow label="Status" value="Active Warning" />
              <DetailRow label="Hazard" value={warning.hazard_label} />
              <DetailRow
                label="Warning level"
                value={`${warning.warning_level.label} — ${warning.warning_level.scale}`}
              />
              <DetailRow label="Issued at" value={formatWarningDateTime(warning.issued_at)} />
              <DetailRow label="Valid until" value={formatWarningDateTime(warning.valid_until)} />
              <DetailRow label="Source" value={warning.source.name} />
              {warning.source_reference ? (
                <DetailRow label="Source reference" value={warning.source_reference} />
              ) : null}
              {warning.last_updated ? (
                <DetailRow label="Last updated" value={formatWarningDateTime(warning.last_updated)} />
              ) : null}
            </View>

            <View style={styles.scaleNote}>
              <IconSymbol name="shield.fill" size={17} color="#176B87" />
              <Text style={styles.scaleNoteText}>
                Warning levels shown here use the CIVENTRAL Warning Level scale.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 112 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 7, marginBottom: 8 },
  backArrow: { fontSize: 28, lineHeight: 22, color: '#176B87', marginRight: 5 },
  backText: { fontSize: 13, fontWeight: '800', color: '#176B87' },
  stateCard: { minHeight: 240, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  stateTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 12 },
  stateText: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 19, marginTop: 6 },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#176B87', borderRadius: 10 },
  retryText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  inlineError: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  inlineErrorText: { fontSize: 11, color: '#92400E', lineHeight: 16 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cityText: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.8 },
  hazard: { fontSize: 11, fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' },
  title: { fontSize: 23, fontWeight: '900', color: '#0F172A', lineHeight: 29, marginVertical: 8 },
  contextText: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 14 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  summary: { fontSize: 14, color: '#334155', lineHeight: 21 },
  areaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  areaCopy: { flex: 1, marginLeft: 9 },
  areaName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  areaScope: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginTop: 1 },
  mutedText: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  detailRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: '#0F172A', lineHeight: 19, marginTop: 3 },
  scaleNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E0F2FE', borderRadius: 14, padding: 14 },
  scaleNoteText: { flex: 1, fontSize: 11, color: '#0F4C61', lineHeight: 16, marginLeft: 8 },
});

