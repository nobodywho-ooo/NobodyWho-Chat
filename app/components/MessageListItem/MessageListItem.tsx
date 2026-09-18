import React from 'react';
import { DisplayMessage } from 'types';

import { AssistantMessage } from './AssistantMessage/AssistantMessage';
import { UserMessage } from './UserMessage/UserMessage';
import { SystemBlock } from './SystemBlock';

interface MessageListItemProps {
  message: DisplayMessage;
  isStreaming?: boolean;
  messageId?: string;
  canPlayAudio?: boolean;
  isAudioLoading?: boolean;
  isAudioPlaying?: boolean;
  onPlayAudio?: (messageId: string, text: string) => void;
  onStopAudio?: () => void;
}

export const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  isStreaming = false,
  messageId = '',
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
        messageId={messageId}
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
