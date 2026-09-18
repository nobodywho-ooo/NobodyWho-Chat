import React from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import { copyToClipboard } from 'helpers';
import { DisplayMessage } from 'types';

import { AssistantMessage } from '../AssistantMessage/AssistantMessage';
import styles from '../AssistantMessage/AssistantMessage.styles';

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
      messageId="row:0"
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

test('shimmers a thinking label while an empty message is streaming', () => {
  const message: DisplayMessage = { role: 'assistant', content: '' };
  const screen = renderAssistant(message, { isStreaming: true });
  const shimmer = screen.UNSAFE_getByType('ShimmerText' as never);
  expect(shimmer.props.text).toBe('components.messageListItem.thinking');
  expect(screen.queryByRole('button')).toBeNull();
});

test('shows no thinking label once the message has content', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'streaming…' };
  const screen = renderAssistant(message, { isStreaming: true });
  expect(screen.UNSAFE_queryByType('ShimmerText' as never)).toBeNull();
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
    messageId: 'row:3',
    canPlayAudio: true,
    onPlayAudio,
  });

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  // The message's own identity and the thinking-free text are handed to the
  // synthesizer — not its row number, which the next turn can shift.
  expect(onPlayAudio).toHaveBeenCalledWith('row:3', 'Yes, the water is wet');
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

// --- Re-render cost --------------------------------------------------------

test('skips re-rendering when nothing about the message changed', () => {
  // A streaming turn rewrites the messages array on every token while leaving
  // finished answers untouched. Those rows must not re-parse their markdown
  // each time, which is what the memo around AssistantMessage buys.
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'an answer that is already finished',
  };
  const markdown = EnrichedMarkdownText as unknown as jest.Mock;

  const screen = renderAssistant(message);
  const rendersAfterMount = markdown.mock.calls.length;
  expect(rendersAfterMount).toBeGreaterThan(0);

  screen.update(
    <AssistantMessage
      message={message}
      isStreaming={false}
      messageId="row:0"
      canPlayAudio={false}
      isAudioLoading={false}
      isAudioPlaying={false}
    />,
  );

  expect(markdown.mock.calls.length).toBe(rendersAfterMount);
});

test('re-renders when the message content grows', () => {
  const markdown = EnrichedMarkdownText as unknown as jest.Mock;
  const screen = renderAssistant({ role: 'assistant', content: 'partial' });
  const rendersAfterMount = markdown.mock.calls.length;

  // A new message object is what the streaming update produces for the row
  // being written, so that row still re-renders.
  screen.update(
    <AssistantMessage
      message={{ role: 'assistant', content: 'partial answer' }}
      isStreaming={false}
      messageId="row:0"
      canPlayAudio={false}
      isAudioLoading={false}
      isAudioPlaying={false}
    />,
  );

  expect(markdown.mock.calls.length).toBeGreaterThan(rendersAfterMount);
});

// --- Footer ----------------------------------------------------------------

test('keeps the footer out of the layout while the answer streams', () => {
  // Nothing in the footer is offered mid-turn: copy and read-aloud both wait
  // for the answer to finish, and the metrics only exist once it has. An empty
  // footer still carries its top margin, so rendering one grows the row under
  // the reader for nothing.
  const message: DisplayMessage = {
    role: 'assistant',
    content: '<think>still reasoning',
  };
  const screen = renderAssistant(message, { isStreaming: true });

  expect(screen.queryByLabelText('components.messageListItem.copy')).toBeNull();
  expect(screen.queryByText(/tok\/s/)).toBeNull();
  // The reasoning is on screen, so the row rendered — just without a footer.
  expect(
    screen.getByLabelText('components.messageListItem.viewThinking'),
  ).toBeTruthy();
  expect(screen.UNSAFE_queryByProps(styles.footerContainer)).toBeNull();
});

test('brings the footer back once the answer is finished', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'the finished answer',
  };
  const screen = renderAssistant(message);

  expect(screen.getByLabelText('components.messageListItem.copy')).toBeTruthy();
});
