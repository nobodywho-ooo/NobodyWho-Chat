import React, { useCallback, useEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { WebSearchTraceRow as Row } from 'services';
import { Spacings } from 'style';

import { ROW_INDENT, WEB_TRACE_TRANSITION_MS } from './constants';
import { WebSearchTraceRow } from './WebSearchTraceRow';

interface WebSearchTraceListProps {
  expanded: boolean;
  rows: Row[];
  enterDelay: Map<string, number>;
  animateRows: boolean;
  continuesBelow?: boolean;
  onOpen: (url?: string) => void;
  onOpenChallenge: () => void;
  onCollapsed: () => void;
}

const ACCORDION_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

// An accordion over the measured list: the rows are laid out absolutely so
// their natural height can be read while the clip animates between 0 and it.
export const WebSearchTraceList: React.FC<WebSearchTraceListProps> = ({
  expanded,
  rows,
  enterDelay,
  animateRows,
  continuesBelow = false,
  onOpen,
  onOpenChallenge,
  onCollapsed,
}) => {
  const listHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyCollapsed = useCallback(() => {
    if (mountedRef.current) {
      onCollapsed();
    }
  }, [onCollapsed]);

  useEffect(() => {
    const timing = {
      duration: WEB_TRACE_TRANSITION_MS,
      easing: ACCORDION_EASING,
    };
    if (expanded) {
      if (contentHeight.value > 0) {
        listHeight.value = withTiming(contentHeight.value, timing);
      }
      return;
    }
    listHeight.value = withTiming(0, timing, finished => {
      if (finished) {
        scheduleOnRN(notifyCollapsed);
      }
    });
  }, [expanded, listHeight, contentHeight, notifyCollapsed]);

  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next <= 0) {
        return;
      }
      contentHeight.value = next;
      if (expanded) {
        listHeight.value = withTiming(next, {
          duration: WEB_TRACE_TRANSITION_MS,
          easing: ACCORDION_EASING,
        });
      }
    },
    [expanded, listHeight, contentHeight],
  );

  const listClipStyle = useAnimatedStyle(() => ({ height: listHeight.value }));

  return (
    <Animated.View style={[styles.listClip, listClipStyle]}>
      <View style={styles.list} onLayout={handleListLayout}>
        {rows.map((row, index) => (
          <Animated.View
            key={row.key}
            layout={
              animateRows
                ? LinearTransition.duration(WEB_TRACE_TRANSITION_MS)
                : undefined
            }
            entering={
              animateRows
                ? FadeInDown.duration(WEB_TRACE_TRANSITION_MS).delay(
                    enterDelay.get(row.key) ?? 0,
                  )
                : undefined
            }
          >
            <WebSearchTraceRow
              row={row}
              isFirst={index === 0}
              isLast={!continuesBelow && index === rows.length - 1}
              onOpen={onOpen}
              onOpenChallenge={onOpenChallenge}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  listClip: {
    marginTop: Spacings.xs,
    overflow: 'hidden',
  },
  list: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: ROW_INDENT,
  },
});
