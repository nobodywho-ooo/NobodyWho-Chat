import React from 'react';
import { Switch } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { getAppState, setAppState, DEFAULT_ASSISTANT_CONFIG } from 'database';

import {
  CustomizeAssistantScreen,
  TOKENS_MIN,
  TOKENS_STEP,
} from '../CustomizeAssistantScreen';

beforeEach(async () => {
  await setAppState({ assistantConfig: undefined });
});

test('renders correctly CustomizeAssistantScreen', () => {
  expect(render(<CustomizeAssistantScreen />).toJSON()).toMatchSnapshot();
});

test('toggling thinking persists the config', () => {
  const screen = render(<CustomizeAssistantScreen />);

  const [thinkingSwitch] = screen.UNSAFE_getAllByType(Switch);
  fireEvent(thinkingSwitch, 'valueChange', false);

  expect(getAppState().assistantConfig).toEqual({
    ...DEFAULT_ASSISTANT_CONFIG,
    thinking: false,
  });
});

test('toggling tool calling persists the config', () => {
  const screen = render(<CustomizeAssistantScreen />);

  const [, toolCallingSwitch] = screen.UNSAFE_getAllByType(Switch);
  fireEvent(toolCallingSwitch, 'valueChange', false);

  expect(getAppState().assistantConfig).toEqual({
    ...DEFAULT_ASSISTANT_CONFIG,
    toolCalling: false,
  });
});

test('the stepper changes max tokens by 500 and clamps at the minimum', () => {
  const screen = render(<CustomizeAssistantScreen />);

  // The default is already at the maximum, so increasing is a no-op.
  const plus = screen.getByLabelText(
    'screens.customizeAssistant.increaseMaxTokens',
  );
  fireEvent.press(plus);
  expect(getAppState().assistantConfig?.contextSize).toBe(
    DEFAULT_ASSISTANT_CONFIG.contextSize,
  );

  const minus = screen.getByLabelText(
    'screens.customizeAssistant.decreaseMaxTokens',
  );
  const presses =
    (DEFAULT_ASSISTANT_CONFIG.contextSize - TOKENS_MIN) / TOKENS_STEP;
  for (let i = 0; i < presses; i++) {
    fireEvent.press(minus);
  }
  expect(getAppState().assistantConfig?.contextSize).toBe(TOKENS_MIN);

  // At the minimum the decrease button is disabled.
  fireEvent.press(minus);
  expect(getAppState().assistantConfig?.contextSize).toBe(TOKENS_MIN);
});

test('editing the system prompt persists on end editing', () => {
  const screen = render(<CustomizeAssistantScreen />);

  const input = screen.getByPlaceholderText(
    'screens.customizeAssistant.systemPromptPlaceholder',
  );
  fireEvent.changeText(input, 'You are a pirate.');
  // Typing alone is not persisted yet — only the local state changes.
  expect(getAppState().assistantConfig).toBeUndefined();

  fireEvent(input, 'endEditing');
  expect(getAppState().assistantConfig).toEqual({
    ...DEFAULT_ASSISTANT_CONFIG,
    systemPrompt: 'You are a pirate.',
  });
});

test('pending changes are persisted when the screen closes', () => {
  const screen = render(<CustomizeAssistantScreen />);

  const input = screen.getByPlaceholderText(
    'screens.customizeAssistant.systemPromptPlaceholder',
  );
  fireEvent.changeText(input, 'You are a pirate.');
  expect(getAppState().assistantConfig).toBeUndefined();

  screen.unmount();
  expect(getAppState().assistantConfig).toEqual({
    ...DEFAULT_ASSISTANT_CONFIG,
    systemPrompt: 'You are a pirate.',
  });
});
