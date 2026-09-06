import React from 'react';
import { Linking, Modal } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { StreamdownText } from 'react-native-streamdown';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';

import { ThinkingModal } from '../AssistantMessage/ThinkingModal';

const mockStreamdown = StreamdownText as unknown as jest.Mock;
const mockEnriched = EnrichedMarkdownText as unknown as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the title and the reasoning with the static renderer when not active', () => {
  const { getByText } = render(
    <ThinkingModal thinking="some reasoning" onClose={jest.fn()} />,
  );

  expect(getByText('components.messageListItem.thinkingTitle')).toBeTruthy();
  expect(mockEnriched.mock.calls[0][0].markdown).toBe('some reasoning');
  expect(mockStreamdown).not.toHaveBeenCalled();
});

test('uses the streaming renderer while thinking is active', () => {
  render(
    <ThinkingModal thinking="streaming reasoning" active onClose={jest.fn()} />,
  );

  expect(mockStreamdown.mock.calls[0][0].markdown).toBe('streaming reasoning');
  expect(mockEnriched).not.toHaveBeenCalled();
});

test('opens a tapped link in the reasoning', () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  render(
    <ThinkingModal
      thinking="see [link](https://example.com)"
      onClose={jest.fn()}
    />,
  );

  mockEnriched.mock.calls[0][0].onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('calls onClose when the close button is pressed', () => {
  const onClose = jest.fn();
  const { getByLabelText } = render(
    <ThinkingModal thinking="x" onClose={onClose} />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.closeThinking'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden when thinking is null', () => {
  const { UNSAFE_getByType } = render(
    <ThinkingModal thinking={null} onClose={jest.fn()} />,
  );

  expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
});

test('matches the snapshot when open', () => {
  const { toJSON } = render(
    <ThinkingModal thinking="some reasoning" onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
