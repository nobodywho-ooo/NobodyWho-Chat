// A2UI Map renderer: a real interactive map backed by react-native-maps.
//
// Markers and the route are handed to the native map as lat/lon — no manual
// projection, so pins sit exactly on the streets and the map supports
// pan/zoom. Height follows the A2UI variant; when the model gave us no
// coordinates at all, a schematic fallback is drawn instead of a blank map.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapViewNative, { Marker, Polyline, type Region } from 'react-native-maps';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import type { A2UiMapMarker, A2UiMapPoint } from '../../services/a2ui/types';

const HEIGHTS = { small: 120, medium: 180, large: 240 } as const;

interface MapViewProps {
  markers: A2UiMapMarker[];
  route?: A2UiMapPoint[];
  variant?: 'small' | 'medium' | 'large';
}

export const MapView: React.FC<MapViewProps> = ({ markers, route, variant }) => {
  const { colors } = useStyled();
  const height = HEIGHTS[variant ?? 'medium'] ?? HEIGHTS.medium;

  const region = useRegion(route, markers);

  if (region === null) {
    return <SchematicMap height={height} />;
  }

  // A pin without explicit coordinates anchors to the route point with the
  // same index (the last one holds the extras); the native map needs a lat/lon.
  const positionedMarkers = markers.map((marker, i) => {
    if (marker.lat !== undefined && marker.lon !== undefined) {
      return { marker, point: { lat: marker.lat, lon: marker.lon } };
    }
    if (route && route.length > 0) {
      return { marker, point: route[Math.min(i, route.length - 1)] };
    }
    return { marker, point: { lat: region.latitude, lon: region.longitude } };
  });

  return (
    <View
      pointerEvents="auto"
      style={{
        height,
        width: '100%',
        alignSelf: 'stretch',
        borderRadius: Spacings.md,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <MapViewNative
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        region={region}
      >
        {route !== undefined && route.length > 1 ? (
          <Polyline
            coordinates={route.map(p => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor={colors.primary}
            strokeWidth={5}
          />
        ) : null}
        {positionedMarkers.map(({ marker, point }, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: point.lat, longitude: point.lon }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.surface,
                }}
              >
                <PlatformIcon
                  iosIconName="location"
                  androidIconName="location_on"
                  size={18}
                  color="#ffffff"
                />
              </View>
              {typeof marker.label === 'string' ? (
                <View
                  style={{
                    marginTop: 2,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    maxWidth: 120,
                  }}
                >
                  <Text
                    style={{ fontSize: 9, fontWeight: '600', color: colors.onSurface }}
                    numberOfLines={1}
                  >
                    {marker.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </Marker>
        ))}
      </MapViewNative>
    </View>
  );
};

// A region covering every coordinate, with a lap so nothing sits on an edge.
function useRegion(
  route: A2UiMapPoint[] | undefined,
  markers: A2UiMapMarker[],
): Region | null {
  return React.useMemo(() => {
    const points: A2UiMapPoint[] = [
      ...(route ?? []),
      ...markers.flatMap(m =>
        m.lat !== undefined && m.lon !== undefined ? [{ lat: m.lat, lon: m.lon }] : [],
      ),
    ];
    if (points.length === 0) return null;

    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    let latSpan = maxLat - minLat;
    let lonSpan = maxLon - minLon;
    if (latSpan < 1e-4) latSpan = 1e-3;
    if (lonSpan < 1e-4) lonSpan = 1e-3;
    latSpan *= 1.35;
    lonSpan *= 1.35;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: latSpan,
      longitudeDelta: lonSpan,
    };
  }, [route, markers]);
}

// No coordinates at all: draw a schematic placeholder rather than a blank box.
const SchematicMap: React.FC<{ height: number }> = ({ height }) => {
  const { colors } = useStyled();
  return (
    <View
      style={{
        height,
        width: '100%',
        alignSelf: 'stretch',
        borderRadius: Spacings.md,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surfaceContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PlatformIcon
        iosIconName="map"
        androidIconName="map"
        size={28}
        color={colors.onSurfaceVariant}
      />
      <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 }}>Map</Text>
    </View>
  );
};