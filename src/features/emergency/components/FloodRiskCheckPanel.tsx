import type { FloodCheckState } from '@/src/features/emergency/drrmFloodCheckState';
import type { FloodReferenceClassification, FloodReferenceResult } from '@/src/types/drrmFloodReference';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CLASSIFICATION_COLORS: Record<FloodReferenceClassification, { backgroundColor: string; color: string }> = {
  LOW: { backgroundColor: '#7DD3FC', color: '#0F172A' },
  MODERATE: { backgroundColor: '#38BDF8', color: '#0F172A' },
  HIGH: { backgroundColor: '#2563EB', color: '#FFFFFF' },
  'VERY HIGH': { backgroundColor: '#1E3A8A', color: '#FFFFFF' },
};

const MAPPED_REFERENCE_DISCLAIMER = 'This is a planning reference based on controlled draft GIS data. It is not a TensorFlow prediction, real-time flood forecast, or official emergency advisory.';
const AI_UNAVAILABLE_MESSAGE = 'TensorFlow prediction is unavailable until a governed model and validated forecast inputs are ready.';

interface FloodRiskCheckPanelProps {
  state: FloodCheckState;
  selectingLocation: boolean;
  selectionError: string | null;
  onStartLocationSelection: () => void;
  onCancelLocationSelection: () => void;
  onCheck: () => void;
  onClear: () => void;
}

function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function formatFloodClassification(classification: FloodReferenceClassification): string {
  return classification.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ResultMetadata({ result }: { result: FloodReferenceResult }) {
  return (
    <View style={styles.metadata}>
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Source Status</Text>
        <Text style={styles.metadataValue}>{result.source_status.replace('_', ' ')}</Text>
      </View>
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Reference Source</Text>
        <Text style={styles.metadataValue}>{result.reference_source}</Text>
      </View>
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Selected Location</Text>
        <Text style={styles.metadataValue}>{formatCoordinates(result.location.latitude, result.location.longitude)}</Text>
      </View>
    </View>
  );
}

function FloodReferenceResultPanel({ result }: { result: FloodReferenceResult }) {
  return (
    <>
      <View style={styles.resultPanel} testID="flood-reference-result">
        <Text style={styles.resultTitle}>Flood Reference Check</Text>
        {result.intersection ? (
          <>
            <Text style={styles.resultLabel}>Reference Classification</Text>
            <View style={[styles.classificationBadge, { backgroundColor: CLASSIFICATION_COLORS[result.classification].backgroundColor }]}>
              <Text style={[styles.classificationText, { color: CLASSIFICATION_COLORS[result.classification].color }]}>
                {result.classification}
              </Text>
            </View>
            <ResultMetadata result={result} />
            {result.overlap_count > 1 ? (
              <Text style={styles.overlapNotice}>
                Multiple mapped reference polygons overlap this location. The highest mapped susceptibility class is shown.
              </Text>
            ) : null}
            <Text style={styles.interpretation}>
              The selected location intersects a {formatFloodClassification(result.classification)} flood susceptibility reference polygon.
            </Text>
            <Text style={styles.mappedDisclaimer}>{MAPPED_REFERENCE_DISCLAIMER}</Text>
          </>
        ) : (
          <>
            <Text style={styles.noIntersectionTitle}>NO MAPPED REFERENCE INTERSECTION</Text>
            <Text style={styles.noIntersectionText}>
              No mapped flood susceptibility polygon intersects this selected location in the current controlled draft reference dataset.
            </Text>
            <ResultMetadata result={result} />
            <Text style={styles.backendWarning}>{result.warning}</Text>
          </>
        )}
      </View>
      <View style={styles.aiPanel} testID="ai-flood-prediction-unavailable">
        <Text style={styles.aiTitle}>AI Flood Prediction</Text>
        <Text style={styles.aiStatus}>Not available</Text>
        <Text style={styles.aiMessage}>{AI_UNAVAILABLE_MESSAGE}</Text>
      </View>
    </>
  );
}

export function FloodRiskCheckPanel({
  state,
  selectingLocation,
  selectionError,
  onStartLocationSelection,
  onCancelLocationSelection,
  onCheck,
  onClear,
}: FloodRiskCheckPanelProps) {
  const canCheck = state.location !== null && !state.loading && !selectingLocation;

  return (
    <View testID="flood-risk-check-workflow">
      <Text style={styles.locationLabel}>Flood Risk Location</Text>
      <View style={styles.selectionField}>
        <Text style={[styles.selectionText, !state.location && styles.placeholderText]}>
          {state.location ? 'Location selected' : 'No location selected'}
        </Text>
        {state.location ? (
          <Text style={styles.secondarySelectionText}>{formatCoordinates(state.location[1], state.location[0])}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={state.loading}
        onPress={onStartLocationSelection}
        style={[styles.locationButton, state.loading && styles.disabledSecondaryButton]}>
        <Text style={styles.locationButtonText}>{state.location ? 'Change Location' : 'Set Location on Map'}</Text>
      </TouchableOpacity>
      {selectingLocation ? (
        <View style={styles.selectionInstruction}>
          <View style={styles.selectionInstructionCopy}>
            <Text style={styles.selectionInstructionTitle}>Selecting flood-check location</Text>
            <Text style={styles.selectionInstructionText}>Tap the map to check flood susceptibility at that location</Text>
            {selectionError ? <Text style={styles.selectionError}>{selectionError}</Text> : null}
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={onCancelLocationSelection} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.helperText}>Select an exact point inside Caloocan City.</Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !canCheck }}
        disabled={!canCheck}
        onPress={onCheck}
        style={[styles.checkButton, !canCheck && styles.disabledButton]}>
        <Text style={styles.checkButtonText}>{state.loading ? 'Checking...' : 'Check Flood Reference'}</Text>
      </TouchableOpacity>
      {state.error ? <Text style={styles.requestError}>{state.error}</Text> : null}
      {state.result ? <FloodReferenceResultPanel result={state.result} /> : null}
      {state.location ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={state.loading}
          onPress={onClear}
          style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear Flood Check</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locationLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  selectionField: { minHeight: 48, justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8 },
  selectionText: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  placeholderText: { color: '#64748B', fontWeight: '600' },
  secondarySelectionText: { color: '#64748B', fontSize: 10, marginTop: 3 },
  locationButton: { minHeight: 44, borderWidth: 1, borderColor: '#176B87', borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  locationButtonText: { color: '#176B87', fontSize: 12, fontWeight: '900' },
  disabledSecondaryButton: { opacity: 0.55 },
  selectionInstruction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderRadius: 9, padding: 9, marginTop: 8 },
  selectionInstructionCopy: { flex: 1, paddingRight: 8 },
  selectionInstructionTitle: { color: '#1E40AF', fontSize: 11, fontWeight: '900' },
  selectionInstructionText: { color: '#1E40AF', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  selectionError: { color: '#B91C1C', fontSize: 10, lineHeight: 15, marginTop: 4 },
  cancelButton: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#1D4ED8', fontSize: 11, fontWeight: '900' },
  helperText: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 6 },
  checkButton: { minHeight: 46, borderRadius: 9, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  disabledButton: { backgroundColor: '#CBD5E1' },
  checkButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  requestError: { color: '#B91C1C', fontSize: 11, lineHeight: 16, marginTop: 9 },
  resultPanel: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 14, paddingTop: 12 },
  resultTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  resultLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  classificationBadge: { alignSelf: 'flex-start', minHeight: 36, minWidth: 92, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 5 },
  classificationText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  metadata: { marginTop: 9 },
  metadataRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 7, marginTop: 7 },
  metadataLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  metadataValue: { color: '#0F172A', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 2 },
  overlapNotice: { color: '#1E3A8A', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 9, fontSize: 10, lineHeight: 15, marginTop: 10 },
  interpretation: { color: '#0F172A', fontSize: 11, lineHeight: 17, marginTop: 10 },
  mappedDisclaimer: { color: '#7C2D12', backgroundColor: '#FFF7ED', borderRadius: 8, padding: 9, fontSize: 10, lineHeight: 15, marginTop: 10 },
  noIntersectionTitle: { color: '#9A3412', backgroundColor: '#FFF7ED', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  noIntersectionText: { color: '#0F172A', fontSize: 11, lineHeight: 17, marginTop: 9 },
  backendWarning: { color: '#991B1B', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 9, fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 10 },
  aiPanel: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 11, marginTop: 10 },
  aiTitle: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  aiStatus: { color: '#64748B', fontSize: 11, fontWeight: '800', marginTop: 3 },
  aiMessage: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 5 },
  clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  clearButtonText: { color: '#176B87', fontSize: 11, fontWeight: '900' },
});
