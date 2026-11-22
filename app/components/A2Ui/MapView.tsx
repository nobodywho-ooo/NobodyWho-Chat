// A2UI Map renderer: a stylized, fully-offline map drawn with plain RN views.
//
// There are no tile services on device, so instead of a real slippy map this
// draws a schematic street grid with the route as a polyline of rotated
// segment views and the markers as location pins with label chips. Markers
// without explicit coordinates spread evenly across the box (small models
// rarely emit marker coords); markers with coordinates join the route's
// projection.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import type { A2UiMapMarker, A2UiMapPoint } from '../../services/a2ui/types';

const HEIGHTS = { small: 120, medium: 180, large: 240 } as const;

// The internal math uses a nominal width; the box itself stretches to the
// parent, so proportions are what matter.
const NOMINAL_WIDTH = 320;

const GRID = [0.22, 0.5, 0.78];

interface Positioned {
  x: number;
  y: number;
}

interface MapViewProps {
  markers: A2UiMapMarker[];
  route?: A2UiMapPoint[];
  variant?: 'small' | 'medium' | 'large';
}

export const MapView: React.FC<MapViewProps> = ({ markers, route, variant }) => {
  const { colors } = useStyled();
  const height = HEIGHTS[variant ?? 'medium'] ?? HEIGHTS.medium;

  const positioned = positionMarkers(markers, route, NOMINAL_WIDTH, height);

  return (
    <View
      pointerEvents="none"
      style={{
        height,
        borderRadius: Spacings.md,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surfaceContainer,
      }}
    >
      {/* schematic street grid */}
      {GRID.map((fraction, i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: fraction * height,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
          }}
        />
      ))}
      {GRID.map((fraction, i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: fraction * NOMINAL_WIDTH,
            width: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
          }}
        />
      ))}

      {/* route polyline */}
      {route !== undefined && route.length > 0 ? (
        <>
          {route.length > 1
            ? segments(route, height).map(({ from, to }, i) => (
                <RouteSegment key={i} from={from} to={to} color={colors.primary} />
              ))
            : null}
          <View
            style={{
              position: 'absolute',
              left: project(route[route.length - 1], height).x - 5,
              top: project(route[route.length - 1], height).y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.primary,
            }}
          />
        </>
      ) : null}

      {/* pins */}
      {positioned.map(({ marker, x, y }, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: x - 11, top: y - 26, alignItems: 'center' }}
        >
          <PlatformIcon
            iosIconName="location"
            androidIconName="location_on"
            size={22}
            color={colors.primary}
          />
          {typeof marker.label === 'string' ? (
            <View
              style={{
                marginTop: 2,
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontSize: 9, color: colors.onSurface }} numberOfLines={1}>
                {marker.label}
              </Text>
            </View>
          ) : null}
        </View>
      ))}

      {markers.length === 0 && (route === undefined || route.length === 0) ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>Map</Text>
        </View>
      ) : null}
    </View>
  );
};

// --- Projection ----------------------------------------------------------

// Route points are projected over their own bounds; markers without
// coordinates get fixed percentage slots so the card still reads as "places".
function positionMarkers(
  markers: A2UiMapMarker[],
  route: A2UiMapPoint[] | undefined,
  width: number,
  height: number,
): { marker: A2UiMapMarker; x: number; y: number }[] {
  if (markers.length === 0) return [];

  const anyCoords = markers.some(m => m.lat !== undefined || m.lon !== undefined);
  if (anyCoords) {
    const projectFn = makeProjection(route && route.length > 0 ? route : [], height);
    return markers.map(m => {
      if (m.lat !== undefined && m.lon !== undefined) {
        const p = projectFn({ lat: m.lat, lon: m.lon });
        return { marker: m, x: p.x, y: p.y };
      }
      return { marker: m, x: width / 2, y: height / 2 };
    });
  }

  // Even spread with an alternate stagger so labels don't collide.
  return markers.map((marker, i) => {
    const x = width * ((i + 0.5) / markers.length);
    const y = height * (0.5 + (i % 2 === 0 ? -0.08 : 0.08));
    return { marker, x, y };
  });
}

function makeProjection(
  points: A2UiMapPoint[],
  height: number,
): (p: { lat: number; lon: number }) => Positioned {
  if (points.length === 0) {
    return () => ({ x: NOMINAL_WIDTH / 2, y: height / 2 });
  }
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  if (maxLat - minLat < 1e-6) {
    minLat -= 0.001;
    maxLat += 0.001;
  }
  if (maxLon - minLon < 1e-6) {
    minLon -= 0.001;
    maxLon += 0.001;
  }
  return p => ({
    x: ((p.lon - minLon) / (maxLon - minLon)) * NOMINAL_WIDTH,
    y: (1 - (p.lat - minLat) / (maxLat - minLat)) * height,
  });
}

function project(p: A2UiMapPoint, height: number): Positioned {
  // A single point spans the whole box after the padding in makeProjection.
  return makeProjection([p], height)(p);
}

function segments(points: A2UiMapPoint[], height: number): { from: Positioned; to: Positioned }[] {
  const proj = makeProjection(points, height);
  const out: { from: Positioned; to: Positioned }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ from: proj(points[i]), to: proj(points[i + 1]) });
  }
  return out;
}

// --- Segments ------------------------------------------------------------

const RouteSegment: React.FC<{ from: Positioned; to: Positioned; color: string }> = ({
  from,
  to,
  color,
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - 2,
        width: length,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        opacity: 0.85,
      }}
    />
  );
};