import React from 'react';
import { Linking } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { StreamdownText } from 'react-native-streamdown';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';

import { ThinkingSheet } from '../AssistantMessage/ThinkingSheet';

const mockStreamdown = StreamdownText as unknown as jest.Mock;
const mockEnriched = EnrichedMarkdownText as unknown as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the title and the reasoning with the static renderer when not active', async () => {
  const { getByText } = await render(
    <ThinkingSheet thinking="some reasoning" onClose={jest.fn()} />,
  );

  expect(getByText('components.messageListItem.thinkingTitle')).toBeTruthy();
  expect(mockEnriched.mock.calls[0][0].markdown).toBe('some reasoning');
  expect(mockStreamdown).not.toHaveBeenCalled();
});

test('uses the streaming renderer while thinking is active', async () => {
  await render(
    <ThinkingSheet thinking="streaming reasoning" active onClose={jest.fn()} />,
  );

  expect(mockStreamdown.mock.calls[0][0].markdown).toBe('streaming reasoning');
  expect(mockEnriched).not.toHaveBeenCalled();
});

test('opens a tapped link in the reasoning', async () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(
    <ThinkingSheet
      thinking="see [link](https://example.com)"
      onClose={jest.fn()}
    />,
  );

  mockEnriched.mock.calls[0][0].onLinkPress({ url: 'https://example.com' });

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
});

test('closes when dragged down or the scrim is tapped, with no close button', async () => {
  const onClose = jest.fn();
  const screen = await render(<ThinkingSheet thinking="x" onClose={onClose} />);
  const [sheet] = screen.container.queryAll(
    node => node.type === 'ModalBottomSheet',
  );

  expect(sheet.props.scrimAccessibilityLabel).toBe(
    'components.messageListItem.closeThinking',
  );
  expect(
    screen.container.queryAll(node => node.type === 'IconButton'),
  ).toHaveLength(0);

  await act(() => sheet.props.onIndexChange(0));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden when thinking is null', async () => {
  const { queryByLabelText, queryByText } = await render(
    <ThinkingSheet thinking={null} onClose={jest.fn()} />,
  );

  expect(queryByText('components.messageListItem.thinkingTitle')).toBeNull();
  expect(
    queryByLabelText('components.messageListItem.closeThinking'),
  ).toBeNull();
});

test('matches the snapshot when open', async () => {
  const { toJSON } = await render(
    <ThinkingSheet thinking="some reasoning" onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
