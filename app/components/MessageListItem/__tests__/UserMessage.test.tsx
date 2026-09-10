import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { copyToClipboard } from 'helpers';
import { DisplayMessage } from 'types';

import { UserMessage } from '../UserMessage/UserMessage';

afterEach(() => {
  jest.clearAllMocks();
});

// --- Text bubble -----------------------------------------------------------

test('renders the message text in a bubble', () => {
  const message: DisplayMessage = { role: 'user', content: 'Is the water wet?' };
  const { getByText } = render(<UserMessage message={message} />);
  expect(getByText('Is the water wet?')).toBeTruthy();
});

test('copies the message to the clipboard on long press', () => {
  const message: DisplayMessage = { role: 'user', content: 'hello there' };
  const { getByText } = render(<UserMessage message={message} />);
  fireEvent(getByText('hello there'), 'longPress');
  expect(copyToClipboard).toHaveBeenCalledWith('hello there');
});

test('exposes no button role for a plain text message', () => {
  // The bubble copies via onLongPress, so it is not an accessible button.
  const message: DisplayMessage = { role: 'user', content: 'hello' };
  const { queryByRole } = render(<UserMessage message={message} />);
  expect(queryByRole('button')).toBeNull();
});

test('renders no bubble for an empty message with no attachments', () => {
  const message: DisplayMessage = { role: 'user', content: '' };
  const { queryByText } = render(<UserMessage message={message} />);
  expect(queryByText(/\S/)).toBeNull();
});

// --- Attachments -----------------------------------------------------------

test('renders an image attachment labelled with its file name', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: 'look at this',
    documentsPath: ['/docs/cat-1700000000000-123456.jpg'],
  };
  const { getByLabelText } = render(<UserMessage message={message} />);
  expect(getByLabelText('cat.jpg')).toBeTruthy();
});

test('opens a full-screen viewer when an image attachment is pressed', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: 'look at this',
    documentsPath: ['/docs/cat-1700000000000-123456.jpg'],
  };
  const { getByLabelText, queryByLabelText } = render(
    <UserMessage message={message} />,
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
  const { getByTestId } = render(<UserMessage message={message} />);
  const row = getByTestId('message-attachment-images');
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
  const { getByText } = render(<UserMessage message={message} />);
  expect(getByText('report.pdf')).toBeTruthy();
});

test('renders an audio attachment with a play control', () => {
  const message: DisplayMessage = {
    role: 'user',
    content: '',
    documentsPath: ['/docs/note-1700000000000-123456.m4a'],
  };
  const { getByLabelText } = render(<UserMessage message={message} />);
  expect(
    getByLabelText('components.messageListItem.playAudio'),
  ).toBeTruthy();
});

test('matches the snapshot', () => {
  const message: DisplayMessage = { role: 'user', content: 'Is the water wet?' };
  expect(render(<UserMessage message={message} />).toJSON()).toMatchSnapshot();
});
