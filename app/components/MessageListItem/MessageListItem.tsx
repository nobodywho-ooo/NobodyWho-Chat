import React from 'react';
import { DisplayMessage } from 'types';

import { AssistantMessage } from './AssistantMessage/AssistantMessage';
import { UserMessage } from './UserMessage/UserMessage';
import { SystemBlock } from './SystemBlock';

interface MessageListItemProps {
  message: DisplayMessage;
  isStreaming?: boolean;
  index?: number;
  canPlayAudio?: boolean;
  isAudioLoading?: boolean;
  isAudioPlaying?: boolean;
  onPlayAudio?: (index: number, text: string) => void;
  onStopAudio?: () => void;
}

export const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  isStreaming = false,
  index: messageIndex = 0,
  canPlayAudio = false,
  isAudioLoading = false,
  isAudioPlaying = false,
  onPlayAudio,
  onStopAudio,
}) => {
  const { role, content } = message;

  if (role === 'user') {
    return <UserMessage message={message} />;
  } else if (role === 'assistant') {
    return (
      <AssistantMessage
        message={message}
        isStreaming={isStreaming}
        index={messageIndex}
        canPlayAudio={canPlayAudio}
        isAudioLoading={isAudioLoading}
        isAudioPlaying={isAudioPlaying}
        onPlayAudio={onPlayAudio}
        onStopAudio={onStopAudio}
      />
    );
  } else if (role === 'system') {
    return <SystemBlock content={content} />;
  }

  return null;
};
