import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { VoiceGlow } from '../components';

// Shared values at rest; the glow only reads `.value` from them.
const level = { value: 0 };
const levels = { level, low: level, high: level, active: level } as never;

const gradientsOf = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container
    .queryAll(node => node.type === 'View')
    .map(
      view =>
        StyleSheet.flatten(view.props.style)?.experimental_backgroundImage,
    )
    .filter((gradient): gradient is string => typeof gradient === 'string');

test('piles soft radial blobs in the theme’s glow colours', async () => {
  const screen = await render(<VoiceGlow levels={levels} />);
  const gradients = gradientsOf(screen);

  expect(gradients).toHaveLength(5);
  gradients.forEach(gradient =>
    expect(gradient).toMatch(/^radial-gradient\(closest-side, /),
  );
  // The body wash, back-most: voiceGlowBody (#DFB8A4) fading to nothing.
  expect(gradients[0]).toContain('rgba(223, 184, 164, 1) 0%');
  expect(gradients[0]).toContain('rgba(223, 184, 164, 0) 100%');
});

test('never takes a touch meant for the controls above it', async () => {
  const screen = await render(<VoiceGlow levels={levels} />);

  expect(screen.root?.props.pointerEvents).toBe('none');
});
