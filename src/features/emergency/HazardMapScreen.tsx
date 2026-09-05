import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DrrmHazardMapService } from '@/src/services/drrmHazardMap';
import type {
  AnyHazardMapResponse,
  BarangayLayerResponse,
  BoundaryLayerResponse,
  EvacuationCentersLayerResponse,
  FaultLayerResponse,
  FloodLayerResponse,
  HazardMapLayer,
  LandslideLayerResponse,
  MapFeatureSelection,
  SusceptibilityLevel,
} from '@/src/types/drrmHazardMap';
import { GeoJsonHazardMap } from './components/GeoJsonHazardMap';

const LAYER_LABELS: Record<HazardMapLayer, string> = {
  boundary: 'City Boundary',
  'evacuation-centers': 'Evacuation Centers',
  barangays: 'Barangay Boundaries',
  flood: 'Flood Susceptibility',
  landslide: 'Landslide Susceptibility',
  fault: 'Fault Information',
};

const LAYER_ORDER: HazardMapLayer[] = [
  'boundary',
  'evacuation-centers',
  'barangays',
  'flood',
  'landslide',
  'fault',
];

const INITIAL_ENABLED: Record<HazardMapLayer, boolean> = {
  boundary: true,
  'evacuation-centers': true,
  barangays: false,
  flood: false,
  landslide: false,
  fault: false,
};

const FLOOD_COLORS: Record<SusceptibilityLevel, string> = {
  Low: '#7DD3FC',
  Moderate: '#38BDF8',
  High: '#2563EB',
  'Very High': '#1E3A8A',
};

const LANDSLIDE_COLORS: Record<SusceptibilityLevel, string> = {
  Low: '#FDE68A',
  Moderate: '#F59E0B',
  High: '#C2410C',
  'Very High': '#78350F',
};

type LayerResponses = Partial<Record<HazardMapLayer, AnyHazardMapResponse>>;
type LayerErrors = Partial<Record<HazardMapLayer, string>>;

function errorMessage(layer: HazardMapLayer): string {
  return `${LAYER_LABELS[layer]} could not be loaded.`;
}

function FeatureDetails({ selection, onClose }: { selection: MapFeatureSelection; onClose: () => void }) {
  let title = '';
  let eyebrow = '';
  let rows: { label: string; value: string }[] = [];

  switch (selection.kind) {
    case 'evacuation-center':
      eyebrow = 'EVACUATION CENTER';
      title = selection.properties.name;
      rows = [
        selection.properties.barangay ? { label: 'Barangay', value: selection.properties.barangay } : null,
        selection.properties.location ? { label: 'Location', value: selection.properties.location } : null,
        selection.properties.address ? { label: 'Address', value: selection.properties.address } : null,
        selection.properties.capacity !== undefined ? { label: 'Capacity', value: String(selection.properties.capacity) } : null,
        selection.properties.operational_status ? { label: 'Operational status', value: selection.properties.operational_status } : null,
        selection.properties.verification_status ? { label: 'Verification', value: selection.properties.verification_status } : null,
        selection.properties.managing_office ? { label: 'Managing office', value: selection.properties.managing_office } : null,
        selection.properties.source_context ? { label: 'Source', value: selection.properties.source_context } : null,
      ].filter((row): row is { label: string; value: string } => row !== null);
      if (selection.properties.verification_status?.toLowerCase().includes('pending lgu verification')) {
        rows.push({
          label: 'Notice',
          value: 'Development preview only. This evacuation center reference is pending LGU verification.',
        });
      }
      break;
    case 'barangay':
      eyebrow = 'BARANGAY BOUNDARY';
      title = selection.properties.name;
      rows = [{ label: 'GIS status', value: selection.properties.boundary_status }];
      break;
    case 'flood':
    case 'landslide':
      eyebrow = selection.kind === 'flood' ? 'DENR-MGB FLOOD' : 'DENR-MGB LANDSLIDE';
      title = `${selection.properties.susceptibility} susceptibility`;
      rows = [
        { label: 'Hazard', value: selection.properties.hazard },
        { label: 'Source classification', value: selection.properties.source_classification },
        { label: 'Source', value: 'DENR-MGB' },
      ];
      break;
    case 'fault':
      eyebrow = 'DOST-PHIVOLCS CONTEXT';
      title = selection.properties.name;
      rows = [
        { label: 'Caloocan intersection', value: 'No mapped active fault intersects Caloocan City' },
        { label: 'Distance from city boundary', value: `Approximately ${selection.context.minimum_distance_km.toFixed(2)} km` },
        { label: 'Safety context', value: 'Distance does not mean absence of earthquake risk.' },
      ];
      break;
  }

  return (
    <View style={styles.detailsCard} testID="hazard-map-feature-details">
      <View style={styles.detailsHeader}>
        <View style={styles.detailsHeadingCopy}>
          <Text style={styles.detailsEyebrow}>{eyebrow}</Text>
          <Text style={styles.detailsTitle}>{title}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close feature details" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text style={styles.detailValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SusceptibilityLegend({ title, colors }: { title: string; colors: Record<SusceptibilityLevel, string> }) {
  const levels: SusceptibilityLevel[] = ['Low', 'Moderate', 'High', 'Very High'];
  return (
    <View style={styles.legendGroup}>
      <Text style={styles.legendTitle}>{title}</Text>
      <View style={styles.legendItems}>
        {levels.map((level) => (
          <View key={level} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors[level] }]} />
            <Text style={styles.legendText}>{level}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function HazardMapScreen() {
  const [enabled, setEnabled] = useState(INITIAL_ENABLED);
  const [responses, setResponses] = useState<LayerResponses>({});
  const [loading, setLoading] = useState<Set<HazardMapLayer>>(new Set());
  const [errors, setErrors] = useState<LayerErrors>({});
  const [selection, setSelection] = useState<MapFeatureSelection | null>(null);

  const loadLayer = useCallback(async (layer: HazardMapLayer, forceRefresh = false) => {
    setLoading((current) => new Set(current).add(layer));
    setErrors((current) => ({ ...current, [layer]: undefined }));
    try {
      const response = await DrrmHazardMapService.getLayer(layer, { forceRefresh });
      setResponses((current) => ({ ...current, [layer]: response }));
    } catch {
      setErrors((current) => ({ ...current, [layer]: errorMessage(layer) }));
    } finally {
      setLoading((current) => {
        const next = new Set(current);
        next.delete(layer);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    void loadLayer('boundary');
    void loadLayer('evacuation-centers');
  }, [loadLayer]);

  const toggleLayer = useCallback((layer: HazardMapLayer, value: boolean) => {
    if (layer === 'boundary') return;
    setEnabled((current) => ({ ...current, [layer]: value }));
    if (value && !responses[layer] && !loading.has(layer)) {
      void loadLayer(layer);
    }
    if (!value) {
      setSelection((current) => {
        if (!current) return current;
        const selectedLayer = current.kind === 'evacuation-center' ? 'evacuation-centers' : current.kind;
        return selectedLayer === layer ? null : current;
      });
    }
  }, [loadLayer, loading, responses]);

  const boundary = responses.boundary?.layer === 'boundary' ? responses.boundary as BoundaryLayerResponse : undefined;
  const barangays = enabled.barangays && responses.barangays?.layer === 'barangays'
    ? responses.barangays as BarangayLayerResponse : undefined;
  const flood = enabled.flood && responses.flood?.layer === 'flood'
    ? responses.flood as FloodLayerResponse : undefined;
  const landslide = enabled.landslide && responses.landslide?.layer === 'landslide'
    ? responses.landslide as LandslideLayerResponse : undefined;
  const fault = enabled.fault && responses.fault?.layer === 'fault'
    ? responses.fault as FaultLayerResponse : undefined;
  const evacuationCenters = enabled['evacuation-centers'] && responses['evacuation-centers']?.layer === 'evacuation-centers'
    ? responses['evacuation-centers'] as EvacuationCentersLayerResponse : undefined;
  const evacuationCenterCount = evacuationCenters?.data.features.length ?? 0;
  const hasPublishedEvacuationCenter = evacuationCenters?.data.features.some((feature) =>
    feature.properties.publication_status === 'PUBLISHED' || feature.properties.operational_status === 'OPERATIONAL',
  ) ?? false;
  const evacuationCentersArePreview = evacuationCenters?.development_status.code === 'DEVELOPMENT_PREVIEW'
    && !hasPublishedEvacuationCenter;

  const visibleErrors = useMemo(
    () => LAYER_ORDER.filter((layer) => layer !== 'boundary' && enabled[layer] && errors[layer]),
    [enabled, errors],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CALOOCAN CITY</Text>
            <Text style={styles.title}>Hazard & Evacuation Map</Text>
            <Text style={styles.subtitle}>View hazard areas and evacuation information for disaster preparedness.</Text>
          </View>
          <View style={styles.headingIcon}>
            <IconSymbol name="location.fill" size={25} color="#176B87" />
          </View>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Map Layers</Text>
            <Text style={styles.cardHint}>Load only what you need</Text>
          </View>
          <View style={styles.layerGrid}>
            {LAYER_ORDER.map((layer) => (
              <View key={layer} style={styles.layerControl} testID={`hazard-layer-${layer}`}>
                <View style={styles.layerCopy}>
                  <Text style={styles.layerLabel}>{LAYER_LABELS[layer]}</Text>
                  <Text style={styles.layerState}>
                    {loading.has(layer) ? 'Loading…' : enabled[layer] ? 'Shown' : 'Hidden'}
                  </Text>
                </View>
                {loading.has(layer) ? <ActivityIndicator size="small" color="#176B87" /> : null}
                <Switch
                  accessibilityLabel={`Toggle ${LAYER_LABELS[layer]}`}
                  value={enabled[layer]}
                  disabled={layer === 'boundary'}
                  onValueChange={(value) => toggleLayer(layer, value)}
                  trackColor={{ false: '#CBD5E1', true: '#67B5C8' }}
                  thumbColor={enabled[layer] ? '#176B87' : '#F8FAFC'}
                />
              </View>
            ))}
          </View>
        </View>

        {visibleErrors.map((layer) => (
          <View key={layer} style={styles.layerError}>
            <IconSymbol name="exclamationmark.triangle.fill" size={17} color="#B91C1C" />
            <Text style={styles.layerErrorText}>{errors[layer]}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void loadLayer(layer, true)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!loading.has('evacuation-centers') && !errors['evacuation-centers'] && evacuationCenters && evacuationCenterCount === 0 ? (
          <View style={styles.layerInfo}>
            <IconSymbol name="info.circle.fill" size={17} color="#176B87" />
            <Text style={styles.layerInfoText}>No published evacuation centers are currently available.</Text>
          </View>
        ) : null}

        {loading.has('boundary') && !boundary ? (
          <View style={styles.mapStateCard}>
            <ActivityIndicator color="#176B87" />
            <Text style={styles.mapStateTitle}>Loading Caloocan City map</Text>
            <Text style={styles.mapStateText}>Preparing the city boundary and evacuation information.</Text>
          </View>
        ) : null}

        {!loading.has('boundary') && errors.boundary && !boundary ? (
          <View style={styles.mapStateCard}>
            <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#B91C1C" />
            <Text style={styles.mapStateTitle}>Map data unavailable</Text>
            <Text style={styles.mapStateText}>The Caloocan City boundary could not be loaded. Other CIVENTRAL services remain available.</Text>
            <TouchableOpacity style={styles.primaryRetryButton} onPress={() => void loadLayer('boundary', true)}>
              <Text style={styles.primaryRetryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {boundary ? (
          <View style={styles.mapCard} testID="hazard-map-canvas">
            <View style={styles.mapHeaderRow}>
              <View>
                <Text style={styles.mapTitle}>Caloocan City</Text>
                <Text style={styles.mapMeta}>North and South Caloocan components</Text>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{evacuationCentersArePreview ? 'DEVELOPMENT PREVIEW' : 'PUBLIC GIS'}</Text>
              </View>
            </View>
            <GeoJsonHazardMap
              boundary={boundary}
              barangays={barangays}
              flood={flood}
              landslide={landslide}
              fault={fault}
              evacuationCenters={evacuationCenters}
              onSelect={setSelection}
            />
            <Text style={styles.mapInstruction}>Tap an evacuation center, hazard area, barangay, or fault line for details.</Text>
          </View>
        ) : null}

        {selection ? <FeatureDetails selection={selection} onClose={() => setSelection(null)} /> : null}

        {(flood || landslide || (evacuationCenters && evacuationCenterCount > 0) || fault) ? (
          <View style={styles.legendCard}>
            <Text style={styles.cardTitle}>Map Legend</Text>
            {flood ? <SusceptibilityLegend title="Flood susceptibility · DENR-MGB" colors={FLOOD_COLORS} /> : null}
            {landslide ? <SusceptibilityLegend title="Rain-induced landslide · DENR-MGB" colors={LANDSLIDE_COLORS} /> : null}
            {evacuationCenters && evacuationCenterCount > 0 ? (
              <View style={styles.symbolLegendRow}>
                <View style={styles.centerLegendSymbol}><View style={styles.centerLegendDot} /></View>
                <Text style={styles.symbolLegendText}>{evacuationCentersArePreview ? 'DEVELOPMENT PREVIEW · UNVERIFIED REFERENCE' : 'Published evacuation center'}</Text>
              </View>
            ) : null}
            {fault ? (
              <View style={styles.symbolLegendRow}>
                <View style={styles.faultLegendLine} />
                <Text style={styles.symbolLegendText}>Nearby West Valley Fault context · DOST-PHIVOLCS</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {barangays ? (
          <View style={styles.developmentNote}>
            <IconSymbol name="help.circle.fill" size={17} color="#176B87" />
            <Text style={styles.developmentNoteText}>
              187 validated barangay GIS boundaries available. Barangays 176-A to 176-F are pending validated GIS boundaries.
            </Text>
          </View>
        ) : null}

        {fault ? (
          <View style={styles.faultContextCard}>
            <Text style={styles.faultContextEyebrow}>EARTHQUAKE / FAULT CONTEXT</Text>
            <Text style={styles.faultContextTitle}>West Valley Fault</Text>
            <Text style={styles.faultContextText}>
              No mapped active fault intersects Caloocan City. The nearest known active-fault context is approximately {fault.data.context.minimum_distance_km.toFixed(2)} km from the city boundary. Distance does not mean absence of earthquake risk.
            </Text>
            <Text style={styles.sourceText}>Source: DOST-PHIVOLCS</Text>
          </View>
        ) : null}

        <Text style={styles.footerDisclaimer}>
          Development GIS information for citizen preparedness. Boundaries and locations remain subject to source and LGU verification.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 112 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  headingCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#176B87', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 3, lineHeight: 30 },
  subtitle: { fontSize: 13, color: '#475569', lineHeight: 19, marginTop: 5 },
  headingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  controlsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  cardHint: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  layerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  layerControl: { minWidth: 250, flexGrow: 1, flexBasis: '47%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  layerCopy: { flex: 1, paddingRight: 6 },
  layerLabel: { fontSize: 12, color: '#0F172A', fontWeight: '700' },
  layerState: { fontSize: 10, color: '#64748B', marginTop: 2 },
  layerError: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 11, marginBottom: 8 },
  layerErrorText: { flex: 1, color: '#991B1B', fontSize: 12, marginHorizontal: 8 },
  retryText: { color: '#176B87', fontSize: 12, fontWeight: '800' },
  layerInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', borderRadius: 12, padding: 11, marginBottom: 8 },
  layerInfoText: { flex: 1, color: '#0F4C61', fontSize: 12, marginLeft: 8 },
  mapStateCard: { minHeight: 330, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, marginTop: 2 },
  mapStateTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 11, textAlign: 'center' },
  mapStateText: { fontSize: 12, color: '#64748B', lineHeight: 18, marginTop: 5, textAlign: 'center', maxWidth: 420 },
  primaryRetryButton: { backgroundColor: '#176B87', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 14 },
  primaryRetryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  mapCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 12 },
  mapHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 3, paddingBottom: 10 },
  mapTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  mapMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
  liveBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveBadgeText: { color: '#15803D', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  mapInstruction: { fontSize: 10, color: '#64748B', lineHeight: 15, textAlign: 'center', marginTop: 8 },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.5, borderColor: '#67B5C8', padding: 15, marginTop: 12 },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  detailsHeadingCopy: { flex: 1, paddingRight: 8 },
  detailsEyebrow: { fontSize: 9, fontWeight: '900', color: '#176B87', letterSpacing: 0.8 },
  detailsTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 21, color: '#475569', lineHeight: 23 },
  detailRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, marginTop: 8 },
  detailLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 12, color: '#0F172A', lineHeight: 18, marginTop: 2 },
  legendCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginTop: 12 },
  legendGroup: { marginTop: 11 },
  legendTitle: { fontSize: 11, fontWeight: '800', color: '#334155', marginBottom: 7 },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendSwatch: { width: 15, height: 15, borderRadius: 4, marginRight: 5, borderWidth: 1, borderColor: 'rgba(15,23,42,0.12)' },
  legendText: { fontSize: 10, color: '#475569' },
  symbolLegendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  centerLegendSymbol: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#15803D', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  centerLegendDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#15803D' },
  faultLegendLine: { width: 26, borderTopWidth: 3, borderColor: '#DC2626', borderStyle: 'dashed', marginRight: 8 },
  symbolLegendText: { flex: 1, fontSize: 10, color: '#475569' },
  developmentNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E0F2FE', borderRadius: 13, padding: 12, marginTop: 12 },
  developmentNoteText: { flex: 1, fontSize: 10, color: '#0F4C61', lineHeight: 16, marginLeft: 7 },
  faultContextCard: { backgroundColor: '#FFF7ED', borderRadius: 15, borderWidth: 1, borderColor: '#FED7AA', padding: 14, marginTop: 12 },
  faultContextEyebrow: { fontSize: 9, fontWeight: '900', color: '#9A3412', letterSpacing: 0.7 },
  faultContextTitle: { fontSize: 16, fontWeight: '900', color: '#7C2D12', marginTop: 3 },
  faultContextText: { fontSize: 11, color: '#7C2D12', lineHeight: 17, marginTop: 5 },
  sourceText: { fontSize: 9, fontWeight: '800', color: '#9A3412', marginTop: 8 },
  footerDisclaimer: { fontSize: 10, color: '#64748B', lineHeight: 15, textAlign: 'center', marginTop: 15, paddingHorizontal: 16 },
});
