import React, { useCallback, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  copyToClipboard,
  log,
  haptics,
  messageDocumentKind,
  messageDocumentName,
  messageDocumentUri,
} from 'helpers';
import { useStyled } from 'hooks';
import { DisplayMessage } from 'types';
import { AudioAttachment } from './AudioAttachment';
import { FullScreenImageModal } from './FullScreenImageModal';
import { Text } from '../../Text/Text';

import styles from './UserMessage.styles';

interface UserMessageProps {
  message: DisplayMessage;
}

// A user turn: any attachments (images / audio / files) above a long-press-to-
// copy text bubble. Split out of MessageListItem to keep role dispatch readable.
export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { content } = message;
  const documentsPath = message.documentsPath ?? [];
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const renderAttachedFiles = () => {
    if (documentsPath.length === 0) {
      return null;
    }

    const images: string[] = [];
    const audios: string[] = [];
    const files: string[] = [];

    documentsPath.forEach(path => {
      const kind = messageDocumentKind(path);
      if (kind === 'image') {
        images.push(path);
      } else if (kind === 'audio') {
        audios.push(path);
      } else {
        files.push(path);
      }
    });

    return (
      <View style={styles.attachmentsContainer}>
        {images.length > 0 && (
          <View
            testID="message-attachment-images"
            style={styles.imagesContainer}
          >
            {images.map((path, index) => {
              const uri = messageDocumentUri(path);
              return (
                <Pressable
                  key={`image-${index}-${path}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('components.messageListItem.viewImage')}
                  onPress={() => setFullScreenImage(uri)}
                  style={({ pressed }) => pressed && styles.imagePressed}
                >
                  <Image
                    source={{ uri }}
                    style={styles.imageAttachment}
                    resizeMode="cover"
                    accessibilityLabel={messageDocumentName(path)}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
        {audios.length > 0 && (
          <View testID="message-attachment-audio" style={styles.audioContainer}>
            {audios.map((path, index) => (
              <AudioAttachment key={`audio-${index}-${path}`} path={path} />
            ))}
          </View>
        )}
        {files.map((path, index) => (
          <Text
            key={`file-${index}-${path}`}
            variant="caption"
            style={[styles.attachmentName, { color: colors.onSurfaceVariant }]}
          >
            {messageDocumentName(path)}
          </Text>
        ))}
        <FullScreenImageModal
          uri={fullScreenImage}
          onClose={() => setFullScreenImage(null)}
        />
      </View>
    );
  };

  const handleCopyUser = useCallback(() => {
    try {
      if (content === '') {
        return;
      }
      copyToClipboard(content);
      haptics.medium();
    } catch (error) {
      log('handleCopyUser copy error ', error);
    }
  }, [content]);

  return (
    <View style={styles.userContainer}>
      {renderAttachedFiles()}
      {content.length > 0 && (
        <Pressable
          onLongPress={handleCopyUser}
          style={({ pressed }) => [
            styles.userBubbleContainer,
            { backgroundColor: colors.surfaceContainer },
            pressed && styles.userBubblePressed,
          ]}
        >
          <Text style={styles.text}>{content}</Text>
        </Pressable>
      )}
    </View>
  );
};
