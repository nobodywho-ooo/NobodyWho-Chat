import React from 'react';
import Svg, { Rect } from 'react-native-svg';

const BAR_HEIGHTS = [
  0.3, 0.55, 0.8, 0.45, 1, 0.6, 0.35, 0.7, 0.5, 0.9, 0.4, 0.65, 0.85, 0.5, 0.3,
  0.6, 0.75, 0.4,
];

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MIN_BAR = 0.18;

interface WaveformProps {
  color: string;
  height?: number;
}

export const Waveform: React.FC<WaveformProps> = ({ color, height = 24 }) => {
  const step = BAR_WIDTH + BAR_GAP;
  const width = BAR_HEIGHTS.length * step - BAR_GAP;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {BAR_HEIGHTS.map((value, index) => {
        const barHeight = Math.max(value, MIN_BAR) * height;
        return (
          <Rect
            key={index}
            x={index * step}
            y={(height - barHeight) / 2}
            width={BAR_WIDTH}
            height={barHeight}
            rx={BAR_WIDTH / 2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
};
