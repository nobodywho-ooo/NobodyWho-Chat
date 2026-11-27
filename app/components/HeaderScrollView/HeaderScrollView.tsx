import React, { ComponentRef, Ref, useRef } from 'react';
import {
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { BlurTargetView } from 'expo-blur';

import { GlassScrollEdge } from '../GlassScrollEdge/GlassScrollEdge';

interface HeaderScrollViewProps extends ScrollViewProps {
  ref?: Ref<ComponentRef<typeof ScrollView>>;
}

type Style = ScrollViewProps['contentContainerStyle'];

// Side insets: the iPhone Duo status-bar rail (84 pt) on the left or right edge in landscape
// Padding the content, not the ScrollView, keeps the background scrolling edge to edge.
type PaddingSide =
  'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight';
const AXIS_OF: Record<PaddingSide, 'paddingVertical' | 'paddingHorizontal'> = {
  paddingTop: 'paddingVertical',
  paddingBottom: 'paddingVertical',
  paddingLeft: 'paddingHorizontal',
  paddingRight: 'paddingHorizontal',
};

const paddingOf = (style: Style, side: PaddingSide) => {
  const flat = StyleSheet.flatten(style) ?? {};
  const value = flat[side] ?? flat[AXIS_OF[side]] ?? flat.padding ?? 0;
  return typeof value === 'number' ? value : 0;
};

export const HeaderScrollView: React.FC<HeaderScrollViewProps> = ({
  contentContainerStyle,
  ref,
  ...props
}) => {
  const headerHeight = useHeaderHeight();
  const { bottom, left, right } = useSafeAreaInsets();
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);

  return (
    <View style={styles.fill}>
      <BlurTargetView ref={blurTargetRef} style={styles.fill}>
        <ScrollView
          ref={ref}
          contentInsetAdjustmentBehavior="never"
          contentInset={{ bottom }}
          scrollIndicatorInsets={{ top: headerHeight, bottom }}
          {...props}
          contentContainerStyle={[
            contentContainerStyle,
            {
              paddingTop:
                paddingOf(contentContainerStyle, 'paddingTop') + headerHeight,
              paddingLeft:
                paddingOf(contentContainerStyle, 'paddingLeft') + left,
              paddingRight:
                paddingOf(contentContainerStyle, 'paddingRight') + right,
            },
            Platform.OS === 'android' && {
              paddingBottom:
                paddingOf(contentContainerStyle, 'paddingBottom') + bottom,
            },
          ]}
        />
      </BlurTargetView>
      <GlassScrollEdge anchor={headerHeight} blurTarget={blurTargetRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
