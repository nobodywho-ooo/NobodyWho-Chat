import React from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import { copyToClipboard } from 'helpers';
import { DisplayMessage } from 'types';

import { AssistantMessage } from '../AssistantMessage/AssistantMessage';

afterEach(() => {
  jest.clearAllMocks();
});

// AssistantMessage's props are all required (defaults live in MessageListItem),
// so render through a helper that fills in the non-audio/non-streaming baseline.
const renderAssistant = (
  message: DisplayMessage,
  overrides: Partial<React.ComponentProps<typeof AssistantMessage>> = {},
) =>
  render(
    <AssistantMessage
      message={message}
      isStreaming={false}
      index={0}
      canPlayAudio={false}
      isAudioLoading={false}
      isAudioPlaying={false}
      {...overrides}
    />,
  );

test('matches the snapshot', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  expect(renderAssistant(message).toJSON()).toMatchSnapshot();
});

// --- Metrics ---------------------------------------------------------------

test('shows tokens/sec and time-to-first-token', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
    tokensPerSecond: 42.73,
    timeToFirstToken: 153,
  };
  const { getByText } = renderAssistant(message);
  expect(getByText('42.7 tok/s · 153 ms')).toBeTruthy();
});

test('formats time-to-first-token in seconds once it passes a second', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'done',
    tokensPerSecond: 8,
    timeToFirstToken: 1500,
  };
  const { getByText } = renderAssistant(message);
  expect(getByText('8.0 tok/s · 1.5 s')).toBeTruthy();
});

test('shows no metrics when the message has none', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'no metrics' };
  const { queryByText } = renderAssistant(message);
  expect(queryByText(/tok\/s/)).toBeNull();
});

// --- Copy ------------------------------------------------------------------

test('copies the message content to the clipboard when pressed', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const { getByLabelText } = renderAssistant(message);
  fireEvent.press(getByLabelText('components.messageListItem.copy'));
  expect(copyToClipboard).toHaveBeenCalledWith('Yes, the water is wet');
});

test('copies only the answer, stripping the reasoning', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>secret reasoning</think>the answer',
  };
  const { getByLabelText } = renderAssistant(message);
  fireEvent.press(getByLabelText('components.messageListItem.copy'));
  expect(copyToClipboard).toHaveBeenCalledWith('the answer');
});

test('shows a checkmark icon after copying, then reverts', () => {
  jest.useFakeTimers();
  const message: DisplayMessage = { role: 'assistant', content: 'copy me' };
  const { getByLabelText } = renderAssistant(message);
  const copyButton = getByLabelText('components.messageListItem.copy');
  const icon = () => copyButton.findByType('PlatformIcon' as never);

  expect(icon().props.iosIconName).toBe('doc.on.doc');

  fireEvent.press(copyButton);
  expect(icon().props.iosIconName).toBe('checkmark');

  act(() => {
    jest.runAllTimers();
  });
  expect(icon().props.iosIconName).toBe('doc.on.doc');

  jest.useRealTimers();
});

test('hides the copy button while the message is streaming', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'streaming…' };
  const { queryByLabelText } = renderAssistant(message, { isStreaming: true });
  expect(queryByLabelText('components.messageListItem.copy')).toBeNull();
});

test('shows the copy button once the message is no longer streaming', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'done' };
  const { getByLabelText } = renderAssistant(message, { isStreaming: false });
  expect(getByLabelText('components.messageListItem.copy')).toBeTruthy();
});

test('does not render a copy button while the message is still empty', () => {
  const message: DisplayMessage = { role: 'assistant', content: '' };
  const { queryByRole } = renderAssistant(message);
  expect(queryByRole('button')).toBeNull();
});

// --- Markdown rendering ----------------------------------------------------

test('renders a completed message with EnrichedMarkdownText', () => {
  // A finished message uses the plain renderer (synchronous, correctly measured)
  // rather than the streaming wrapper, which avoids the collapsed-height bug.
  const message: DisplayMessage = { role: 'assistant', content: 'all done' };
  renderAssistant(message, { isStreaming: false });
  expect(EnrichedMarkdownText).toHaveBeenCalled();
  expect(StreamdownText).not.toHaveBeenCalled();
});

test('renders a streaming message with StreamdownText', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'streaming…' };
  renderAssistant(message, { isStreaming: true });
  expect(StreamdownText).toHaveBeenCalled();
  expect(EnrichedMarkdownText).not.toHaveBeenCalled();
});

test('opens a tapped link from a completed message', () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'see [link](https://example.com)',
  };
  renderAssistant(message, { isStreaming: false });

  const [props] = (EnrichedMarkdownText as unknown as jest.Mock).mock.calls[0];
  props.onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('opens a tapped link from a streaming message', () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'see [link](https://example.com)',
  };
  renderAssistant(message, { isStreaming: true });

  const [props] = (StreamdownText as unknown as jest.Mock).mock.calls[0];
  props.onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('renders the answer after </think> separately from the reasoning', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>done reasoning</think>the final answer',
  };
  renderAssistant(message, { isStreaming: true });
  const markdowns = (StreamdownText as unknown as jest.Mock).mock.calls.map(
    ([props]) => props.markdown,
  );
  expect(markdowns).toContain('the final answer');
});

// --- Loading indicator -----------------------------------------------------

test('shows a loading indicator while an empty message is streaming', () => {
  const message: DisplayMessage = { role: 'assistant', content: '' };
  const screen = renderAssistant(message, { isStreaming: true });
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('shows no loading indicator once the message has content', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'streaming…' };
  const screen = renderAssistant(message, { isStreaming: true });
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
});

// --- Thinking block --------------------------------------------------------

test('renders a thinking block when the message starts with <think>', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>weighing options</think>Here is the answer',
  };
  const { getByLabelText } = renderAssistant(message);
  expect(
    getByLabelText('components.messageListItem.viewThinking'),
  ).toBeTruthy();
});

test('does not render a thinking block for a normal message', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'just an answer',
  };
  const { queryByLabelText } = renderAssistant(message);
  expect(
    queryByLabelText('components.messageListItem.viewThinking'),
  ).toBeNull();
});

test('labels the thinking block as in-progress while the reasoning streams', () => {
  // An unclosed <think> means the model is still reasoning.
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>still going',
  };
  const { getByText } = renderAssistant(message, { isStreaming: true });
  expect(getByText('components.messageListItem.thinking')).toBeTruthy();
});

test('opens the thinking modal when the thinking block is pressed', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>weighing options</think>answer',
  };
  const { getByLabelText, queryByLabelText } = renderAssistant(message);
  expect(
    queryByLabelText('components.messageListItem.closeThinking'),
  ).toBeNull();

  fireEvent.press(getByLabelText('components.messageListItem.viewThinking'));

  expect(
    getByLabelText('components.messageListItem.closeThinking'),
  ).toBeTruthy();
});

// --- Read-aloud (TTS) ------------------------------------------------------

test('hides the read-aloud button when no TTS model is active', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  // canPlayAudio is false in the baseline — no TTS model downloaded and active.
  const { queryByLabelText } = renderAssistant(message);
  expect(queryByLabelText('components.messageListItem.playAudio')).toBeNull();
});

test('reads the message aloud (thinking stripped) when a TTS model is active', () => {
  const onPlayAudio = jest.fn();
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>weighing it</think>Yes, the water is wet',
  };
  const { getByLabelText } = renderAssistant(message, {
    index: 3,
    canPlayAudio: true,
    onPlayAudio,
  });

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  // The row index and the thinking-free text are handed to the synthesizer.
  expect(onPlayAudio).toHaveBeenCalledWith(3, 'Yes, the water is wet');
});

test('shows a spinner instead of the read-aloud button while synthesizing', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const screen = renderAssistant(message, {
    canPlayAudio: true,
    isAudioLoading: true,
  });
  expect(
    screen.queryByLabelText('components.messageListItem.playAudio'),
  ).toBeNull();
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
});

test('offers a stop affordance while the message is being read aloud', () => {
  const onStopAudio = jest.fn();
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const { getByLabelText } = renderAssistant(message, {
    canPlayAudio: true,
    isAudioPlaying: true,
    onStopAudio,
  });

  fireEvent.press(getByLabelText('components.messageListItem.stopAudio'));
  expect(onStopAudio).toHaveBeenCalled();
});
