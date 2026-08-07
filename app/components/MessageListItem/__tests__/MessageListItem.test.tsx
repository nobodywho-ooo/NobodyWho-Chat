import React from 'react';
import { render } from '@testing-library/react-native';
import { DisplayMessage } from 'types';

import { MessageListItem } from '../MessageListItem';
import { UserMessage } from '../UserMessage/UserMessage';
import { AssistantMessage } from '../AssistantMessage/AssistantMessage';
import { SystemBlock } from '../SystemBlock';

// MessageListItem is a pure role dispatcher: it renders the right child per role
// and forwards the streaming/audio props. Each role's own rendering is covered
// by UserMessage / AssistantMessage / SystemBlock tests, so the children are
// stubbed here and we assert only the dispatch + prop forwarding.
jest.mock('../UserMessage/UserMessage', () => ({
  UserMessage: jest.fn(() => null),
}));
jest.mock('../AssistantMessage/AssistantMessage', () => ({
  AssistantMessage: jest.fn(() => null),
}));
jest.mock('../SystemBlock', () => ({
  SystemBlock: jest.fn(() => null),
}));

const mockUserMessage = UserMessage as unknown as jest.Mock;
const mockAssistantMessage = AssistantMessage as unknown as jest.Mock;
const mockSystemBlock = SystemBlock as unknown as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

test('renders UserMessage for a user message', () => {
  const message: DisplayMessage = { role: 'user', content: 'hi' };
  render(<MessageListItem message={message} />);

  expect(mockUserMessage).toHaveBeenCalledTimes(1);
  expect(mockUserMessage.mock.calls[0][0]).toMatchObject({ message });
  expect(mockAssistantMessage).not.toHaveBeenCalled();
  expect(mockSystemBlock).not.toHaveBeenCalled();
});

test('renders AssistantMessage for an assistant message', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'answer' };
  render(<MessageListItem message={message} />);

  expect(mockAssistantMessage).toHaveBeenCalledTimes(1);
  expect(mockAssistantMessage.mock.calls[0][0]).toMatchObject({ message });
  expect(mockUserMessage).not.toHaveBeenCalled();
  expect(mockSystemBlock).not.toHaveBeenCalled();
});

test('renders SystemBlock for a system message', () => {
  const message: DisplayMessage = { role: 'system', content: 'be concise' };
  render(<MessageListItem message={message} />);

  expect(mockSystemBlock).toHaveBeenCalledTimes(1);
  expect(mockSystemBlock.mock.calls[0][0]).toMatchObject({
    content: 'be concise',
  });
  expect(mockUserMessage).not.toHaveBeenCalled();
  expect(mockAssistantMessage).not.toHaveBeenCalled();
});

test('renders nothing for an unknown role', () => {
  const message = { role: 'tool', content: 'x' } as unknown as DisplayMessage;
  const { toJSON } = render(<MessageListItem message={message} />);

  expect(toJSON()).toBeNull();
  expect(mockUserMessage).not.toHaveBeenCalled();
  expect(mockAssistantMessage).not.toHaveBeenCalled();
  expect(mockSystemBlock).not.toHaveBeenCalled();
});

test('forwards streaming and audio props to AssistantMessage', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'answer' };
  const onPlayAudio = jest.fn();
  const onStopAudio = jest.fn();
  render(
    <MessageListItem
      message={message}
      isStreaming
      index={4}
      canPlayAudio
      isAudioLoading
      isAudioPlaying
      onPlayAudio={onPlayAudio}
      onStopAudio={onStopAudio}
    />,
  );

  expect(mockAssistantMessage.mock.calls[0][0]).toMatchObject({
    message,
    isStreaming: true,
    index: 4,
    canPlayAudio: true,
    isAudioLoading: true,
    isAudioPlaying: true,
    onPlayAudio,
    onStopAudio,
  });
});

test('applies default streaming/audio props to AssistantMessage when omitted', () => {
  const message: DisplayMessage = { role: 'assistant', content: 'answer' };
  render(<MessageListItem message={message} />);

  expect(mockAssistantMessage.mock.calls[0][0]).toMatchObject({
    isStreaming: false,
    index: 0,
    canPlayAudio: false,
    isAudioLoading: false,
    isAudioPlaying: false,
  });
});
