import React from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import { copyToClipboard } from 'helpers';
import { DisplayMessage } from 'types';

import { MessageListItem } from '../MessageListItem';

jest.unmock('../MessageListItem');

afterEach(() => {
  jest.clearAllMocks();
});

test('renders correctly MessageListItem for user', () => {
  const message: Message = { role: 'user', content: 'Is the water wet?' };
  const tree = render(<MessageListItem message={message} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly MessageListItem for assistant', () => {
  const message: Message = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const tree = render(<MessageListItem message={message} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('shows tokens/sec and time-to-first-token under a streamed message', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
    tokensPerSecond: 42.73,
    timeToFirstToken: 153,
  };
  const { getByText } = render(<MessageListItem message={message} />);
  expect(getByText('42.7 tok/s · 153 ms')).toBeTruthy();
});

test('formats time-to-first-token in seconds once it passes a second', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'done',
    tokensPerSecond: 8,
    timeToFirstToken: 1500,
  };
  const { getByText } = render(<MessageListItem message={message} />);
  expect(getByText('8.0 tok/s · 1.5 s')).toBeTruthy();
});

test('shows no metrics for an assistant message without them', () => {
  const message: Message = { role: 'assistant', content: 'no metrics' };
  const { queryByText } = render(<MessageListItem message={message} />);
  expect(queryByText(/tok\/s/)).toBeNull();
});

test('copies the assistant message content to the clipboard when pressed', () => {
  const message: Message = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const { getByRole } = render(<MessageListItem message={message} />);
  fireEvent.press(getByRole('button'));
  expect(copyToClipboard).toHaveBeenCalledWith('Yes, the water is wet');
});

test('shows a copied confirmation after copying, then reverts', () => {
  jest.useFakeTimers();
  const message: Message = { role: 'assistant', content: 'copy me' };
  const { getByRole, getByText, queryByText } = render(
    <MessageListItem message={message} />,
  );

  expect(getByText('components.messageListItem.copy')).toBeTruthy();

  fireEvent.press(getByRole('button'));
  expect(getByText('components.messageListItem.copied')).toBeTruthy();

  act(() => {
    jest.runAllTimers();
  });
  expect(queryByText('components.messageListItem.copied')).toBeNull();
  expect(getByText('components.messageListItem.copy')).toBeTruthy();

  jest.useRealTimers();
});

test('hides the copy label while the message is streaming', () => {
  const message: Message = { role: 'assistant', content: 'streaming…' };
  const { getByRole, queryByText } = render(
    <MessageListItem message={message} isStreaming />,
  );
  // The copy button still renders; only its text label is hidden mid-stream.
  expect(getByRole('button')).toBeTruthy();
  expect(queryByText('components.messageListItem.copy')).toBeNull();
});

test('shows the copy label once the message is no longer streaming', () => {
  const message: Message = { role: 'assistant', content: 'done' };
  const { getByText } = render(
    <MessageListItem message={message} isStreaming={false} />,
  );
  expect(getByText('components.messageListItem.copy')).toBeTruthy();
});

test('renders a completed assistant message with EnrichedMarkdownText', () => {
  // A finished message uses the plain renderer (synchronous, correctly measured)
  // rather than the streaming wrapper, which avoids the collapsed-height bug on
  // app resume.
  const message: Message = { role: 'assistant', content: 'all done' };
  render(<MessageListItem message={message} isStreaming={false} />);
  expect(EnrichedMarkdownText).toHaveBeenCalled();
  expect(StreamdownText).not.toHaveBeenCalled();
});

test('renders a streaming assistant message with StreamdownText', () => {
  const message: Message = { role: 'assistant', content: 'streaming…' };
  render(<MessageListItem message={message} isStreaming />);
  expect(StreamdownText).toHaveBeenCalled();
  expect(EnrichedMarkdownText).not.toHaveBeenCalled();
});

test('opens a tapped link from a completed assistant message', () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const message: Message = { role: 'assistant', content: 'see [link](https://example.com)' };
  render(<MessageListItem message={message} isStreaming={false} />);

  const [props] = (EnrichedMarkdownText as unknown as jest.Mock).mock.calls[0];
  props.onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('opens a tapped link from a streaming assistant message', () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const message: Message = { role: 'assistant', content: 'see [link](https://example.com)' };
  render(<MessageListItem message={message} isStreaming />);

  const [props] = (StreamdownText as unknown as jest.Mock).mock.calls[0];
  props.onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('does not render a copy button for user messages', () => {
  const message: Message = { role: 'user', content: 'hello' };
  const { queryByRole } = render(<MessageListItem message={message} />);
  expect(queryByRole('button')).toBeNull();
});

test('copies a user message to the clipboard on long press', () => {
  const message: Message = { role: 'user', content: 'hello there' };
  const { getByText } = render(<MessageListItem message={message} />);
  fireEvent(getByText('hello there'), 'longPress');
  expect(copyToClipboard).toHaveBeenCalledWith('hello there');
});

test('does not render a copy button while an assistant message is still empty', () => {
  const message: Message = { role: 'assistant', content: '' };
  const { queryByRole } = render(<MessageListItem message={message} />);
  expect(queryByRole('button')).toBeNull();
});

test('shows a loading indicator while an empty assistant message is streaming', () => {
  const message: Message = { role: 'assistant', content: '' };
  const screen = render(<MessageListItem message={message} isStreaming />);
  // The spinner stands in for the not-yet-arrived response; no copy button yet.
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('shows no loading indicator once the assistant message has content', () => {
  const message: Message = { role: 'assistant', content: 'streaming…' };
  const screen = render(<MessageListItem message={message} isStreaming />);
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
});

test('renders an image attachment as an image labelled with its file name', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: 'look at this',
    documentsPath: ['/docs/cat-1700000000000-123456.jpg'],
  };
  const { getByLabelText } = render(<MessageListItem message={message} />);
  expect(getByLabelText('cat.jpg')).toBeTruthy();
});

test('opens a full-screen viewer when an image attachment is pressed', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: 'look at this',
    documentsPath: ['/docs/cat-1700000000000-123456.jpg'],
  };
  const { getByLabelText, queryByLabelText } = render(
    <MessageListItem message={message} />,
  );
  expect(
    queryByLabelText('components.messageListItem.closeImage'),
  ).toBeNull();

  fireEvent.press(getByLabelText('components.messageListItem.viewImage'));

  expect(
    getByLabelText('components.messageListItem.closeImage'),
  ).toBeTruthy();
});

test('groups multiple images together in a single row', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: '',
    documentsPath: [
      '/docs/a-1700000000000-1.jpg',
      '/docs/b-1700000000000-2.png',
    ],
  };
  const { getByTestId } = render(<MessageListItem message={message} />);
  const row = getByTestId('message-attachment-images');
  // The container is a flex row, and both images live inside it.
  expect(row.props.style).toEqual(
    expect.objectContaining({ flexDirection: 'row' }),
  );
  expect(within(row).getByLabelText('a.jpg')).toBeTruthy();
  expect(within(row).getByLabelText('b.png')).toBeTruthy();
});

test('renders a non-media attachment as its file name', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: 'a doc',
    documentsPath: ['/docs/report-1700000000000-123456.pdf'],
  };
  const { getByText } = render(<MessageListItem message={message} />);
  expect(getByText('report.pdf')).toBeTruthy();
});

test('plays an audio attachment when the play button is pressed', async () => {
  const message: DisplayMessage = {
    role: 'user',
    content: '',
    documentsPath: ['/docs/note-1700000000000-123456.m4a'],
  };
  const { getByLabelText, findByLabelText } = render(
    <MessageListItem message={message} />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  // The button flips to a pause affordance once playback starts.
  expect(
    await findByLabelText('components.messageListItem.pauseAudio'),
  ).toBeTruthy();
});

test('pauses a playing audio attachment on a second press', async () => {
  const message: DisplayMessage = {
    role: 'user',
    content: '',
    documentsPath: ['/docs/note-1700000000000-123456.m4a'],
  };
  const { getByLabelText, findByLabelText } = render(
    <MessageListItem message={message} />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));
  const pauseButton = await findByLabelText(
    'components.messageListItem.pauseAudio',
  );

  fireEvent.press(pauseButton);
  expect(
    await findByLabelText('components.messageListItem.playAudio'),
  ).toBeTruthy();
});

test('renders a thinking block when the message starts with <think>', () => {
  const message: Message = {
    role: 'assistant',
    content: '<think>weighing options</think>Here is the answer',
  };
  const { getByLabelText } = render(<MessageListItem message={message} />);
  expect(
    getByLabelText('components.messageListItem.viewThinking'),
  ).toBeTruthy();
});

test('does not render a thinking block for a normal assistant message', () => {
  const message: Message = { role: 'assistant', content: 'just an answer' };
  const { queryByLabelText } = render(<MessageListItem message={message} />);
  expect(
    queryByLabelText('components.messageListItem.viewThinking'),
  ).toBeNull();
});

test('labels the thinking block as in-progress while the reasoning streams', () => {
  // An unclosed <think> means the model is still reasoning.
  const message: Message = { role: 'assistant', content: '<think>still going' };
  const { getByText } = render(
    <MessageListItem message={message} isStreaming />,
  );
  expect(getByText('components.messageListItem.thinking')).toBeTruthy();
});

test('opens the thinking modal when the thinking block is pressed', () => {
  const message: Message = {
    role: 'assistant',
    content: '<think>weighing options</think>answer',
  };
  const { getByLabelText, queryByLabelText } = render(
    <MessageListItem message={message} />,
  );
  expect(
    queryByLabelText('components.messageListItem.closeThinking'),
  ).toBeNull();

  fireEvent.press(getByLabelText('components.messageListItem.viewThinking'));

  expect(
    getByLabelText('components.messageListItem.closeThinking'),
  ).toBeTruthy();
});

test('renders the answer after </think>, separate from the reasoning', () => {
  const message: Message = {
    role: 'assistant',
    content: '<think>done reasoning</think>the final answer',
  };
  render(<MessageListItem message={message} isStreaming />);
  const markdowns = (StreamdownText as unknown as jest.Mock).mock.calls.map(
    ([props]) => props.markdown,
  );
  // The reasoning and the answer render as two separate pieces.
  expect(markdowns).toContain('done reasoning');
  expect(markdowns).toContain('the final answer');
});

test('copies only the answer, stripping the reasoning', () => {
  const message: Message = {
    role: 'assistant',
    content: '<think>secret reasoning</think>the answer',
  };
  const { getByLabelText } = render(<MessageListItem message={message} />);
  fireEvent.press(getByLabelText('components.messageListItem.copy'));
  expect(copyToClipboard).toHaveBeenCalledWith('the answer');
});
