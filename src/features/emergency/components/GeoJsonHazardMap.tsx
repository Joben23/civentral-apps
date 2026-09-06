import type { EvacuationRoutePreview } from '@/src/types/drrmEvacuationRoute';
import type {
    BarangayLayerResponse,
    BoundaryLayerResponse,
    EvacuationCentersLayerResponse,
    FaultLayerResponse,
    FloodLayerResponse,
    HazardSusceptibilityProperties,
    LandslideLayerResponse,
    MapFeatureSelection,
    MultiLineStringGeometry,
    MultiPolygonGeometry,
    PolygonGeometry,
    Position,
} from '@/src/types/drrmHazardMap';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 720;
const MAP_PADDING = 42;
const MAX_ZOOM = 6;

const FLOOD_COLORS: Record<HazardSusceptibilityProperties['susceptibility'], string> = {
  Low: '#7DD3FC',
  Moderate: '#38BDF8',
  High: '#2563EB',
  'Very High': '#1E3A8A',
};

const LANDSLIDE_COLORS: Record<HazardSusceptibilityProperties['susceptibility'], string> = {
  Low: '#FDE68A',
  Moderate: '#F59E0B',
  High: '#C2410C',
  'Very High': '#78350F',
};

interface MapBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

interface GeoJsonHazardMapProps {
  boundary: BoundaryLayerResponse;
  barangays?: BarangayLayerResponse;
  flood?: FloodLayerResponse;
  landslide?: LandslideLayerResponse;
  fault?: FaultLayerResponse;
  evacuationCenters?: EvacuationCentersLayerResponse;
  selectedCenterReferenceId?: string;
  startingLocation?: Position;
  route?: EvacuationRoutePreview | null;
  locationSelectionMode: boolean;
  onSelect: (selection: MapFeatureSelection) => void;
  onMapTap: (position: Position) => void;
  onInvalidMapTap: () => void;
}

function positionsFromPolygon(geometry: PolygonGeometry | MultiPolygonGeometry): Position[] {
  if (geometry.type === 'Polygon') return geometry.coordinates.flat();
  return geometry.coordinates.flat(2);
}

function positionsFromLine(geometry: FaultLayerResponse['data']['geometry']['features'][number]['geometry']): Position[] {
  return geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
}

function calculateBounds(
  boundary: BoundaryLayerResponse,
  barangays?: BarangayLayerResponse,
  flood?: FloodLayerResponse,
  landslide?: LandslideLayerResponse,
  fault?: FaultLayerResponse,
  evacuationCenters?: EvacuationCentersLayerResponse,
): MapBounds {
  const positions = boundary.data.features.flatMap((feature) => positionsFromPolygon(feature.geometry));
  if (barangays) positions.push(...barangays.data.features.flatMap((feature) => positionsFromPolygon(feature.geometry)));
  if (flood) positions.push(...flood.data.features.flatMap((feature) => positionsFromPolygon(feature.geometry)));
  if (landslide) positions.push(...landslide.data.features.flatMap((feature) => positionsFromPolygon(feature.geometry)));
  if (fault) {
    positions.push(...fault.data.geometry.features.flatMap((feature) => positionsFromLine(feature.geometry)));
  }
  if (evacuationCenters) {
    positions.push(...evacuationCenters.data.features.map((feature) => feature.geometry.coordinates));
  }

  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.05, 0.002);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.05, 0.002);

  return {
    minLongitude: minLongitude - longitudePadding,
    maxLongitude: maxLongitude + longitudePadding,
    minLatitude: minLatitude - latitudePadding,
    maxLatitude: maxLatitude + latitudePadding,
  };
}

function createProjection(bounds: MapBounds) {
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.000001);
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.000001);
  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;
  const scale = Math.min(usableWidth / longitudeRange, usableHeight / latitudeRange);
  const renderedWidth = longitudeRange * scale;
  const renderedHeight = latitudeRange * scale;
  const xOffset = (MAP_WIDTH - renderedWidth) / 2;
  const yOffset = (MAP_HEIGHT - renderedHeight) / 2;

  return ([longitude, latitude]: Position): [number, number] => [
    xOffset + (longitude - bounds.minLongitude) * scale,
    yOffset + (bounds.maxLatitude - latitude) * scale,
  ];
}

function screenToPosition(
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  translationX: number,
  translationY: number,
  bounds: MapBounds,
): Position | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;
  const localX = (screenX - translationX) / zoom;
  const localY = (screenY - translationY) / zoom;
  const svgScale = Math.min(viewportWidth / MAP_WIDTH, viewportHeight / MAP_HEIGHT);
  const svgOffsetX = (viewportWidth - MAP_WIDTH * svgScale) / 2;
  const svgOffsetY = (viewportHeight - MAP_HEIGHT * svgScale) / 2;
  const svgX = (localX - svgOffsetX) / svgScale;
  const svgY = (localY - svgOffsetY) / svgScale;
  const longitudeRange = Math.max(bounds.maxLongitude - bounds.minLongitude, 0.000001);
  const latitudeRange = Math.max(bounds.maxLatitude - bounds.minLatitude, 0.000001);
  const mapScale = Math.min((MAP_WIDTH - MAP_PADDING * 2) / longitudeRange, (MAP_HEIGHT - MAP_PADDING * 2) / latitudeRange);
  const renderedWidth = longitudeRange * mapScale;
  const renderedHeight = latitudeRange * mapScale;
  const mapOffsetX = (MAP_WIDTH - renderedWidth) / 2;
  const mapOffsetY = (MAP_HEIGHT - renderedHeight) / 2;
  const longitude = bounds.minLongitude + (svgX - mapOffsetX) / mapScale;
  const latitude = bounds.maxLatitude - (svgY - mapOffsetY) / mapScale;
  if (longitude < bounds.minLongitude || longitude > bounds.maxLongitude || latitude < bounds.minLatitude || latitude > bounds.maxLatitude) {
    return null;
  }
  return [longitude, latitude];
}

function pointInRing([longitude, latitude]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
      && longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude)
        / (previousLatitude - currentLatitude) + currentLongitude;
    if (intersects) inside = !inside;
  }
  return inside;
}

function positionInsideBoundary(position: Position, boundary: BoundaryLayerResponse): boolean {
  return boundary.data.features.some((feature) => feature.geometry.coordinates.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return pointInRing(position, outerRing) && !holes.some((hole) => pointInRing(position, hole));
  }));
}

function ringPath(ring: Position[], project: (position: Position) => [number, number]): string {
  return ring
    .map((position, index) => {
      const [x, y] = project(position);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ') + ' Z';
}

function polygonPath(
  geometry: PolygonGeometry | MultiPolygonGeometry,
  project: (position: Position) => [number, number],
): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map((ring) => ringPath(ring, project))).join(' ');
}

function linePath(
  geometry: FaultLayerResponse['data']['geometry']['features'][number]['geometry'],
  project: (position: Position) => [number, number],
): string {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : (geometry as MultiLineStringGeometry).coordinates;
  return lines
    .map((line) =>
      line
        .map((position, index) => {
          const [x, y] = project(position);
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' '),
    )
    .join(' ');
}

function positionsPath(positions: Position[], project: (position: Position) => [number, number]): string {
  return positions
    .map((position, index) => {
      const [x, y] = project(position);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function GeoJsonHazardMapComponent({
  boundary,
  barangays,
  flood,
  landslide,
  fault,
  evacuationCenters,
  selectedCenterReferenceId,
  startingLocation,
  route,
  locationSelectionMode,
  onSelect,
  onMapTap,
  onInvalidMapTap,
}: GeoJsonHazardMapProps) {
  const [panEnabled, setPanEnabled] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const zoom = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startTranslationX = useSharedValue(0);
  const startTranslationY = useSharedValue(0);

  const mapBounds = useMemo(
    () => calculateBounds(boundary, barangays, flood, landslide, fault, evacuationCenters),
    [barangays, boundary, evacuationCenters, fault, flood, landslide],
  );
  const projection = useMemo(() => createProjection(mapBounds), [mapBounds]);
  const handleMapTapFromScreen = (screenX: number, screenY: number, currentZoom: number, currentTranslationX: number, currentTranslationY: number, width: number, height: number) => {
    const position = screenToPosition(screenX, screenY, width, height, currentZoom, currentTranslationX, currentTranslationY, mapBounds);
    if (!position || !positionInsideBoundary(position, boundary)) {
      onInvalidMapTap();
      return;
    }
    onMapTap(position);
  };

  const boundaryPaths = useMemo(
    () => boundary.data.features.map((feature) => polygonPath(feature.geometry, projection)),
    [boundary, projection],
  );
  const barangayPaths = useMemo(
    () => barangays?.data.features.map((feature) => polygonPath(feature.geometry, projection)) ?? [],
    [barangays, projection],
  );
  const floodPaths = useMemo(
    () => flood?.data.features.map((feature) => polygonPath(feature.geometry, projection)) ?? [],
    [flood, projection],
  );
  const landslidePaths = useMemo(
    () => landslide?.data.features.map((feature) => polygonPath(feature.geometry, projection)) ?? [],
    [landslide, projection],
  );

  const clampTranslation = (value: number, scale: number, viewportSize: number): number => {
    'worklet';
    const maximum = Math.max(0, (viewportSize * scale - viewportSize) / 2);
    return Math.min(maximum, Math.max(-maximum, value));
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, startZoom.value * event.scale));
      const focalOffsetX = event.focalX - viewportWidth.value / 2;
      const focalOffsetY = event.focalY - viewportHeight.value / 2;
      zoom.value = nextZoom;
      translationX.value = clampTranslation(
        startTranslationX.value + (1 - nextZoom / startZoom.value) * focalOffsetX,
        nextZoom,
        viewportWidth.value,
      );
      translationY.value = clampTranslation(
        startTranslationY.value + (1 - nextZoom / startZoom.value) * focalOffsetY,
        nextZoom,
        viewportHeight.value,
      );
    })
    .onEnd(() => {
      if (zoom.value <= 1.001) {
        zoom.value = 1;
        translationX.value = 0;
        translationY.value = 0;
        runOnJS(setPanEnabled)(false);
        runOnJS(setShowReset)(false);
      } else {
        runOnJS(setPanEnabled)(true);
        runOnJS(setShowReset)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(panEnabled)
    .minDistance(10)
    .onStart(() => {
      startTranslationX.value = translationX.value;
      startTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      translationX.value = clampTranslation(
        startTranslationX.value + event.translationX,
        zoom.value,
        viewportWidth.value,
      );
      translationY.value = clampTranslation(
        startTranslationY.value + event.translationY,
        zoom.value,
        viewportHeight.value,
      );
    })
    .onEnd(() => {
      runOnJS(setShowReset)(true);
    });

  const tapGesture = Gesture.Tap()
    .enabled(locationSelectionMode)
    .maxDistance(12)
    .maxDuration(500)
    .shouldCancelWhenOutside(false)
    .onEnd((event, success) => {
      if (!success) return;
      runOnJS(handleMapTapFromScreen)(event.x, event.y, zoom.value, translationX.value, translationY.value, viewportWidth.value, viewportHeight.value);
    });

  const animatedMapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: zoom.value },
    ],
  }));

  const resetView = () => {
    zoom.value = 1;
    translationX.value = 0;
    translationY.value = 0;
    setPanEnabled(false);
    setShowReset(false);
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel="Interactive Caloocan City hazard and evacuation map"
      onLayout={(event) => {
        viewportWidth.value = event.nativeEvent.layout.width;
        viewportHeight.value = event.nativeEvent.layout.height;
      }}>
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(tapGesture, panGesture))}>
        <Animated.View style={[styles.mapCanvas, animatedMapStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#EFF6F8" rx={24} />
        <G opacity={0.42}>
          {[160, 320, 480, 640, 800].map((x) => (
            <Line key={`vertical-${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} stroke="#CBD5E1" strokeWidth={1} />
          ))}
          {[120, 240, 360, 480, 600].map((y) => (
            <Line key={`horizontal-${y}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="#CBD5E1" strokeWidth={1} />
          ))}
        </G>

        {boundaryPaths.map((path, index) => (
          <Path key={`boundary-fill-${index}`} d={path} fill="#DFF4EA" fillRule="evenodd" />
        ))}

        {flood?.data.features.map((feature, index) => (
          <Path
            key={`flood-${index}`}
            d={floodPaths[index]}
            fill={FLOOD_COLORS[feature.properties.susceptibility]}
            fillOpacity={0.55}
            stroke="#1D4ED8"
            strokeOpacity={0.45}
            strokeWidth={1.2}
            fillRule="evenodd"
            onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'flood', properties: feature.properties })}
          />
        ))}

        {landslide?.data.features.map((feature, index) => (
          <Path
            key={`landslide-${index}`}
            d={landslidePaths[index]}
            fill={LANDSLIDE_COLORS[feature.properties.susceptibility]}
            fillOpacity={0.52}
            stroke="#92400E"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            fillRule="evenodd"
            onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'landslide', properties: feature.properties })}
          />
        ))}

        {route ? (
          <Path
            d={positionsPath(route.route.coordinates, projection)}
            fill="none"
            stroke="#F97316"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ) : null}

        {barangays?.data.features.map((feature, index) => (
          <Path
            key={`barangay-${feature.properties.psgc_code}`}
            d={barangayPaths[index]}
            fill="none"
            stroke="#64748B"
            strokeOpacity={0.75}
            strokeWidth={1.1}
            fillRule="evenodd"
            onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'barangay', properties: feature.properties })}
          />
        ))}

        {fault?.data.geometry.features.map((feature, index) => (
          <G key={`fault-${index}`}>
            <Path
              d={linePath(feature.geometry, projection)}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.01}
              strokeWidth={30}
              onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'fault', properties: feature.properties, context: fault.data.context })}
            />
            <Path
              d={linePath(feature.geometry, projection)}
              fill="none"
              stroke="#DC2626"
              strokeWidth={5}
              strokeDasharray="13 9"
              strokeLinecap="round"
              onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'fault', properties: feature.properties, context: fault.data.context })}
            />
          </G>
        ))}

        {boundaryPaths.map((path, index) => (
          <Path
            key={`boundary-outline-${index}`}
            d={path}
            fill="none"
            stroke="#176B87"
            strokeWidth={3.2}
            fillRule="evenodd"
          />
        ))}

        {evacuationCenters?.data.features.map((feature) => {
          const [cx, cy] = projection(feature.geometry.coordinates);
          const isSelected = feature.properties.id === selectedCenterReferenceId;
          return (
            <G
              key={feature.properties.id}
              onPress={locationSelectionMode ? undefined : () => onSelect({ kind: 'evacuation-center', properties: feature.properties })}>
              <Circle cx={cx} cy={cy} r={34} fill="#FFFFFF" fillOpacity={0.01} />
              <Circle cx={cx} cy={cy} r={isSelected ? 18 : 15} fill="#FFFFFF" stroke={isSelected ? '#F97316' : '#15803D'} strokeWidth={isSelected ? 5 : 4} />
              <Circle cx={cx} cy={cy} r={5.5} fill={isSelected ? '#F97316' : '#15803D'} />
            </G>
          );
        })}

        {startingLocation ? (() => {
          const [cx, cy] = projection(startingLocation);
          return (
            <G pointerEvents="none">
              <Circle cx={cx} cy={cy} r={13} fill="#FFFFFF" stroke="#DC2626" strokeWidth={4} />
              <Circle cx={cx} cy={cy} r={5} fill="#DC2626" />
            </G>
          );
        })() : null}

        <G>
          <Circle cx={MAP_WIDTH - 48} cy={48} r={25} fill="#FFFFFF" fillOpacity={0.9} />
          <SvgText x={MAP_WIDTH - 48} y={43} fontSize={20} fontWeight="800" fill="#0F172A" textAnchor="middle">N</SvgText>
          <Path d={`M${MAP_WIDTH - 48} 53 L${MAP_WIDTH - 56} 69 L${MAP_WIDTH - 48} 65 L${MAP_WIDTH - 40} 69 Z`} fill="#176B87" />
        </G>
          </Svg>
        </Animated.View>
      </GestureDetector>
      {showReset ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset map view" onPress={resetView} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const GeoJsonHazardMap = memo(GeoJsonHazardMapComponent);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1.08,
    minHeight: 340,
    maxHeight: 590,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#EFF6F8',
  },
  mapCanvas: {
    width: '100%',
    height: '100%',
  },
  resetButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetButtonText: {
    color: '#176B87',
    fontSize: 11,
    fontWeight: '800',
  },
});
