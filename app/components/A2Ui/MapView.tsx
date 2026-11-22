// A2UI Map renderer.
//
// Draws REAL map data as its backdrop: an OpenStreetMap raster-tile mosaic
// covering the route's bounding box (JS-only, no native map dependency), with
// the route polyline and marker pins overlaid in the same Web-Mercator
// projection as the tiles, so they line up exactly with the streets.
//
// No tiles when there is no coordinate data or while they load — the
// schematic grid stays as the offline/loading fallback underneath.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import type { A2UiMapMarker, A2UiMapPoint } from '../../services/a2ui/types';

const HEIGHTS = { small: 120, medium: 180, large: 240 } as const;

const TILE = 256;

// The internal math uses a nominal size until onLayout reports the real one;
// proportions are preserved either way.
const NOMINAL_WIDTH = 320;
const NOMINAL_HEIGHT = 240;

const GRID = [0.22, 0.5, 0.78];

interface Positioned {
  x: number;
  y: number;
}

interface MapViewProps {
  markers: A2UiMapMarker[];
  route?: A2UiMapPoint[];
  variant?: 'small' | 'medium' | 'large';
  onLayout?: (e: { nativeEvent: { layout: { width: number; height: number } } }) => void;
}

export const MapView: React.FC<MapViewProps> = ({ markers, route, variant, onLayout }) => {
  const { colors } = useStyled();
  const height = HEIGHTS[variant ?? 'medium'] ?? HEIGHTS.medium;
  const [measuredWidth, setMeasuredWidth] = React.useState<number | null>(null);
  const width = measuredWidth ?? NOMINAL_WIDTH;

  // Collect every coordinate (route + markers) so tiles and overlay fit all.
  const points: A2UiMapPoint[] = React.useMemo(
    () => [
      ...(route ?? []),
      ...markers.flatMap(m =>
        m.lat !== undefined && m.lon !== undefined ? [{ lat: m.lat, lon: m.lon }] : [],
      ),
    ],
    [route, markers],
  );

  const layout = layoutOf(points, width, height);
  const positioned = positionMarkers(markers, route, layout, width, height);

  return (
    <View
      onLayout={e => {
        setMeasuredWidth(e.nativeEvent.layout.width);
        if (onLayout) onLayout(e);
      }}
      pointerEvents="none"
      style={{
        height,
        width: '100%',
        alignSelf: 'stretch',
        borderRadius: Spacings.md,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surfaceContainer,
      }}
    >
      {/* offline/loading fallback: schematic street grid */}
      {GRID.map((fraction, i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: fraction * height,
            height: 1,
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
            left: fraction * width,
            width: 1,
            backgroundColor: colors.border,
          }}
        />
      ))}

      {/* real map data: OSM tile mosaic in the same projection as the overlay */}
      {layout && layout.tiles.map(tile => (
        <Image
          key={`${tile.z}/${tile.x}/${tile.y}`}
          source={{ uri: `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png` }}
          style={{
            position: 'absolute',
            left: tile.boxLeft,
            top: tile.boxTop,
            width: tile.boxSize,
            height: tile.boxSize,
          }}
        />
      ))}

      {/* route polyline */}
      {route !== undefined && route.length > 0 ? (
        <>
          {route.length > 1
            ? segments(route, layout).map(({ from, to }, i) => (
                <RouteSegment key={i} from={from} to={to} color={colors.primary} />
              ))
            : null}
          <View
            style={{
              position: 'absolute',
              left: project(route[route.length - 1], layout).x - 6,
              top: project(route[route.length - 1], layout).y - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          />
        </>
      ) : null}

      {/* pins */}
      {positioned.map(({ marker, x, y }, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: x - 16, top: y - 34, alignItems: 'center' }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
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
              size={17}
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
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.onSurface }} numberOfLines={1}>
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

// Web-Mercator pixel coordinates at zoom `z` (y grows downward, like tiles).
const latLonToPx = (lat: number, lon: number, z: number): Positioned => {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n * TILE;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n * TILE;
  return { x, y };
};

// Where markers sit: with coordinates they project with the route; without
// them marker i anchors to route point i; as a last resort, even spread.
function positionMarkers(
  markers: A2UiMapMarker[],
  route: A2UiMapPoint[] | undefined,
  layout: MapLayout | null,
  width: number,
  height: number,
): { marker: A2UiMapMarker; x: number; y: number }[] {
  if (markers.length === 0) return [];

  const anyCoords = markers.some(m => m.lat !== undefined || m.lon !== undefined);
  if (anyCoords) {
    return markers.map(m => {
      if (m.lat !== undefined && m.lon !== undefined) {
        const p = project({ lat: m.lat, lon: m.lon }, layout);
        return { marker: m, x: p.x, y: p.y };
      }
      return { marker: m, x: width / 2, y: height / 2 };
    });
  }

  if (route && route.length > 0) {
    return markers.map((marker, i) => {
      const p = project(route[Math.min(i, route.length - 1)], layout);
      return { marker, x: p.x, y: p.y };
    });
  }

  return markers.map((marker, i) => {
    const x = width * ((i + 0.5) / markers.length);
    const y = height * (0.5 + (i % 2 === 0 ? -0.08 : 0.08));
    return { marker, x, y };
  });
}

interface MapLayout {
  z: number;
  /** The route span in mercator px at z, expanded by a lap so the road
   *  isn't flush against the box edges. */
  worldLeft: number;
  worldTop: number;
  spanX: number;
  spanY: number;
  boxOffsetX: number;
  boxOffsetY: number;
  scale: number;
  tiles: { z: number; x: number; y: number; boxLeft: number; boxTop: number; boxSize: number }[];
}

// Builds the world->box transform + the OSM tile list for a set of points.
function layoutOf(points: A2UiMapPoint[], width: number, height: number): MapLayout | null {
  if (points.length === 0) return null;

  let z = 14;
  const fits = (zoom: number): boolean => {
    const xs = points.map(p => latLonToPx(p.lat, p.lon, zoom).x);
    const ys = points.map(p => latLonToPx(p.lat, p.lon, zoom).y);
    const tileW = Math.max(...xs) - Math.min(...xs);
    const tileH = Math.max(...ys) - Math.min(...ys);
    const n = (tileW / TILE + 1) * (tileH / TILE + 1);
    return n <= 28;
  };
  while (z > 10 && !fits(z)) z -= 1;

  return computeLayout(points, z, width, height);
}

// Central helper: the box-to-world transform at zoom z, with the tiles it
// covers, all in one place so tiles and overlay can share it.
const computeLayout = (
  points: A2UiMapPoint[],
  z: number,
  width: number,
  height: number,
): MapLayout | null => {
  if (points.length === 0) return null;
  const pxs = points.map(p => latLonToPx(p.lat, p.lon, z));
  let minX = Math.min(...pxs.map(p => p.x));
  let minY = Math.min(...pxs.map(p => p.y));
  let maxX = Math.max(...pxs.map(p => p.x));
  let maxY = Math.max(...pxs.map(p => p.y));
  if (maxX - minX < 1) { minX -= 1; maxX += 1; }
  if (maxY - minY < 1) { minY -= 1; maxY += 1; }

  // A comfortable lap around the road.
  const spanX = (maxX - minX) * 1.25;
  const spanY = (maxY - minY) * 1.25;
  const worldLeft = (minX + maxX) / 2 - spanX / 2;
  const worldTop = (minY + maxY) / 2 - spanY / 2;

  const scale = Math.min(width / spanX, height / spanY);
  const boxWidth = spanX * scale;
  const boxHeight = spanY * scale;
  const boxOffsetX = (width - boxWidth) / 2;
  const boxOffsetY = (height - boxHeight) / 2;

  const tile0 = Math.floor(worldLeft / TILE);
  const tile1 = Math.floor((worldLeft + spanX) / TILE);
  const tile2 = Math.floor(worldTop / TILE);
  const tile3 = Math.floor((worldTop + spanY) / TILE);

  const toBox = (wx: number, wy: number): Positioned => ({
    x: (wx - worldLeft) * scale + boxOffsetX,
    y: (wy - worldTop) * scale + boxOffsetY,
  });

  const tiles: MapLayout['tiles'] = [];
  for (let tx = tile0; tx <= tile1; tx++) {
    for (let ty = tile2; ty <= tile3; ty++) {
      const n = 2 ** z;
      const tm = tx < 0 || tx > n - 1 || ty < 0 || ty > n - 1; // off-world edge
      if (tm) continue;
      const pos = toBox(tx * TILE, ty * TILE);
      tiles.push({
        z, x: tx, y: ty,
        boxLeft: pos.x,
        boxTop: pos.y,
        boxSize: TILE * scale,
      });
    }
  }

  if (tiles.length === 0) return null;

  return { z, worldLeft, worldTop, spanX, spanY, boxOffsetX, boxOffsetY, scale, tiles };
};

// A point (lat/lon) -> position in the box, matching the tile mosaic exactly.
function project(p: A2UiMapPoint, layout: MapLayout | null): Positioned {
  if (!layout) return { x: NOMINAL_WIDTH / 2, y: NOMINAL_HEIGHT / 2 };
  const px = latLonToPx(p.lat, p.lon, layout.z);
  return {
    x: (px.x - layout.worldLeft) * layout.scale + layout.boxOffsetX,
    y: (px.y - layout.worldTop) * layout.scale + layout.boxOffsetY,
  };
}

function segments(points: A2UiMapPoint[], layout: MapLayout | null): { from: Positioned; to: Positioned }[] {
  if (!layout) return [];
  const out: { from: Positioned; to: Positioned }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({
      from: project(points[i], layout),
      to: project(points[i + 1], layout),
    });
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
        top: (from.y + to.y) / 2 - 4,
        width: length,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        opacity: 0.92,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
};