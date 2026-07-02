import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { useStyled } from 'hooks';

import styles, { THUMB_SIZE } from './Slider.styles';

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  onSlidingComplete,
}) => {
  const { colors } = useStyled();
  const [trackWidth, setTrackWidth] = useState(0);

  const stateRef = useRef({
    trackWidth,
    value,
    minimumValue,
    maximumValue,
    step,
    onValueChange,
    onSlidingComplete,
    grantX: 0,
  });
  stateRef.current = {
    ...stateRef.current,
    trackWidth,
    value,
    minimumValue,
    maximumValue,
    step,
    onValueChange,
    onSlidingComplete,
  };

  const valueFromX = useCallback((x: number) => {
    const {
      trackWidth: width,
      minimumValue: min,
      maximumValue: max,
      step: stp,
    } = stateRef.current;
    if (width <= 0) {
      return stateRef.current.value;
    }
    const ratio = Math.min(Math.max(x / width, 0), 1);
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / stp) * stp;
    const decimals = (String(stp).split('.')[1] ?? '').length;
    return Math.min(Math.max(Number(stepped.toFixed(decimals)), min), max);
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const {
          value: current,
          minimumValue: min,
          maximumValue: max,
          trackWidth: width,
        } = stateRef.current;
        const ratio = max > min ? (current - min) / (max - min) : 0;
        stateRef.current.grantX = ratio * width;
      },
      onPanResponderMove: (_event, gesture) => {
        stateRef.current.onValueChange?.(
          valueFromX(stateRef.current.grantX + gesture.dx),
        );
      },
      onPanResponderRelease: (_event, gesture) => {
        stateRef.current.onSlidingComplete?.(
          valueFromX(stateRef.current.grantX + gesture.dx),
        );
      },
    }),
  ).current;

  const ratio =
    maximumValue > minimumValue
      ? Math.min(
          Math.max((value - minimumValue) / (maximumValue - minimumValue), 0),
          1,
        )
      : 0;

  return (
    <View
      style={styles.container}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
      {...responder.panHandlers}
    >
      <View
        style={[styles.track, { backgroundColor: colors.surfaceContainer }]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: ratio * trackWidth,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.primary,
            left: ratio * Math.max(trackWidth - THUMB_SIZE, 0),
          },
        ]}
      />
    </View>
  );
};
