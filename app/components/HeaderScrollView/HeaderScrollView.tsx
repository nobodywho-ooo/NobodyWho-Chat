import React, { ComponentRef, Ref, useRef } from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { BlurTargetView } from 'expo-blur';

import { GlassScrollEdge } from '../GlassScrollEdge/GlassScrollEdge';

interface HeaderScrollViewProps extends ScrollViewProps {
  ref?: Ref<ComponentRef<typeof ScrollView>>;
}

const paddingTopOf = (style: ScrollViewProps['contentContainerStyle']) => {
  const flat = StyleSheet.flatten(style) ?? {};
  const top = flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0;
  return typeof top === 'number' ? top : 0;
};

export const HeaderScrollView: React.FC<HeaderScrollViewProps> = ({
  contentContainerStyle,
  ref,
  ...props
}) => {
  const headerHeight = useHeaderHeight();
  const { bottom } = useSafeAreaInsets();
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
            { paddingTop: paddingTopOf(contentContainerStyle) + headerHeight },
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
