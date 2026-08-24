import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
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

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 720;
const MAP_PADDING = 42;

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
  onSelect: (selection: MapFeatureSelection) => void;
}

function positionsFromPolygon(geometry: PolygonGeometry | MultiPolygonGeometry): Position[] {
  if (geometry.type === 'Polygon') return geometry.coordinates.flat();
  return geometry.coordinates.flat(2);
}

function positionsFromLine(geometry: FaultLayerResponse['data']['geometry']['features'][number]['geometry']): Position[] {
  return geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
}

function calculateBounds(boundary: BoundaryLayerResponse, fault?: FaultLayerResponse): MapBounds {
  const positions = boundary.data.features.flatMap((feature) => positionsFromPolygon(feature.geometry));
  if (fault) {
    positions.push(...fault.data.geometry.features.flatMap((feature) => positionsFromLine(feature.geometry)));
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

function GeoJsonHazardMapComponent({
  boundary,
  barangays,
  flood,
  landslide,
  fault,
  evacuationCenters,
  onSelect,
}: GeoJsonHazardMapProps) {
  const projection = useMemo(() => createProjection(calculateBounds(boundary, fault)), [boundary, fault]);

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

  return (
    <View style={styles.container} accessibilityLabel="Interactive Caloocan City hazard and evacuation map">
      <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
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
            onPress={() => onSelect({ kind: 'flood', properties: feature.properties })}
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
            onPress={() => onSelect({ kind: 'landslide', properties: feature.properties })}
          />
        ))}

        {barangays?.data.features.map((feature, index) => (
          <Path
            key={`barangay-${feature.properties.psgc_code}`}
            d={barangayPaths[index]}
            fill="none"
            stroke="#64748B"
            strokeOpacity={0.75}
            strokeWidth={1.1}
            fillRule="evenodd"
            onPress={() => onSelect({ kind: 'barangay', properties: feature.properties })}
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
              onPress={() => onSelect({ kind: 'fault', properties: feature.properties, context: fault.data.context })}
            />
            <Path
              d={linePath(feature.geometry, projection)}
              fill="none"
              stroke="#DC2626"
              strokeWidth={5}
              strokeDasharray="13 9"
              strokeLinecap="round"
              onPress={() => onSelect({ kind: 'fault', properties: feature.properties, context: fault.data.context })}
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
          return (
            <G
              key={feature.properties.id}
              onPress={() => onSelect({ kind: 'evacuation-center', properties: feature.properties })}>
              <Circle cx={cx} cy={cy} r={34} fill="#FFFFFF" fillOpacity={0.01} />
              <Circle cx={cx} cy={cy} r={15} fill="#FFFFFF" stroke="#15803D" strokeWidth={4} />
              <Circle cx={cx} cy={cy} r={5.5} fill="#15803D" />
            </G>
          );
        })}

        <G>
          <Circle cx={MAP_WIDTH - 48} cy={48} r={25} fill="#FFFFFF" fillOpacity={0.9} />
          <SvgText x={MAP_WIDTH - 48} y={43} fontSize={20} fontWeight="800" fill="#0F172A" textAnchor="middle">N</SvgText>
          <Path d={`M${MAP_WIDTH - 48} 53 L${MAP_WIDTH - 56} 69 L${MAP_WIDTH - 48} 65 L${MAP_WIDTH - 40} 69 Z`} fill="#176B87" />
        </G>
      </Svg>
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
});
