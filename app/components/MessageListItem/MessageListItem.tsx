import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import {
  copyToClipboard,
  log,
  getMarkdownStyle,
  haptics,
  messageDocumentKind,
  messageDocumentName,
  messageDocumentUri,
  parseThinking,
  stripThinkingBlocks,
} from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { AiModelState, useAiService } from 'services';
import { DisplayMessage } from 'types';
import { AudioAttachment } from './AudioAttachment';
import { FullScreenImageModal } from './FullScreenImageModal';
import { SystemBlock } from './SystemBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { ThinkingModal } from './ThinkingModal';
import { ToolCallBlock } from './ToolCallBlock';
import { ToolCallModal } from './ToolCallModal';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

const COPIED_RESET_MS = 1500;

const formatTimeToFirstToken = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface MessageListItemProps {
  message: DisplayMessage;
  isStreaming?: boolean;
}

const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  isStreaming = false,
}) => {
  const { t } = useTranslation();
  const { content, role, tokensPerSecond, timeToFirstToken } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const { tts, ttsState } = useAiService();
  const [copied, setCopied] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  // Holds the synthesized-speech player and its backing WAV file for this
  // message, so a second press toggles playback instead of re-synthesizing and
  // so both are freed on unmount. A per-instance id keeps the cache filenames
  // of sibling messages from colliding.
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const audioFileId = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Guards the synthesis path so double-taps while a clip is being generated
  // (synthesis is slow, and no player exists yet) don't kick off a second one.
  const isPreparingRef = useRef(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [openToolIndex, setOpenToolIndex] = useState<number | null>(null);
  const documentsPath = message.documentsPath ?? [];
  const toolInvocations = message.toolInvocations ?? [];

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

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  const { thinking, rest, isThinkingComplete } = useMemo(
    () => parseThinking(content),
    [content],
  );

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

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

  const handleCopy = useCallback(() => {
    try {
      const text = stripThinkingBlocks(content);
      if (text === '') {
        return;
      }
      copyToClipboard(text);
      haptics.medium();
      setCopied(true);
    } catch (error) {
      log('handleCopy copy error ', error);
    }
  }, [content]);

  const teardownPlayback = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      try {
        player.remove();
      } catch (error) {
        log('MessageListItem teardownPlayback remove', error);
      }
    }
    const file = audioFileRef.current;
    audioFileRef.current = null;
    if (file) {
      try {
        if (file.exists) {
          file.delete();
        }
      } catch (error) {
        log('MessageListItem teardownPlayback delete', error);
      }
    }
  }, []);

  // Free the native player and its cache file when the message scrolls out.
  useEffect(() => teardownPlayback, [teardownPlayback]);

  const handlePlayAudio = useCallback(async () => {
    // Ignore taps while a clip is still being synthesized.
    if (isPreparingRef.current) {
      return;
    }

    // Already synthesized: just toggle playback rather than regenerating. The
    // decision is driven by our own `playingAudio` state (kept in sync by the
    // status listener below) because the imperative player's `.playing` getter
    // can lag the real state, which left pause unresponsive.
    const player = playerRef.current;
    if (player) {
      try {
        if (playingAudio) {
          player.pause();
          setPlayingAudio(false);
        } else {
          if (player.currentStatus.didJustFinish) {
            player.seekTo(0);
          }
          player.play();
          setPlayingAudio(true);
        }
        haptics.medium();
      } catch (error) {
        log('handlePlayAudio toggle error', error);
      }
      return;
    }

    const text = stripThinkingBlocks(content);
    const synthesizer = tts.current;
    if (text === '' || !synthesizer) {
      return;
    }

    try {
      isPreparingRef.current = true;
      // Optimistic feedback: synthesis is slow, so flip the icon immediately.
      setPlayingAudio(true);

      // NobodyWho returns WAV bytes; expo-audio plays from a URI, so persist
      // them to the cache directory first. write() creates/overwrites the file.
      const wav = await synthesizer.synthesize(text);
      log(
        `TTS synthesized ${wav.byteLength} bytes ` +
          `(header "${String.fromCharCode(...wav.subarray(0, 4))}")`,
      );
      const file = new File(Paths.cache, `tts-${audioFileId}.wav`);
      file.write(wav);
      audioFileRef.current = file;

      // createAudioPlayer (unlike the useAudioPlayer hook) doesn't activate a
      // playback session, so on iOS the audio converter / file player fail to
      // prepare (AudioConverterService -302 / FigFilePlayer -12864). Re-assert
      // the session — it's idempotent — right before creating the player.
      await setAudioModeAsync({ playsInSilentMode: true });

      const newPlayer = createAudioPlayer({ uri: file.uri });
      playerRef.current = newPlayer;
      newPlayer.addListener('playbackStatusUpdate', status => {
        // Surface the human-readable decode/playback error rather than leaving
        // only the raw CoreAudio spew in the native log.
        if (status.error) {
          setPlayingAudio(false);
          log('handlePlayAudio playback failed', status.error);
        } else if (status.didJustFinish) {
          // Reset the button once the clip finishes (there's no auto-loop).
          setPlayingAudio(false);
        }
      });
      newPlayer.play();
      haptics.medium();
    } catch (error) {
      setPlayingAudio(false);
      teardownPlayback();
      log('handlePlayAudio synthesize error', error);
    } finally {
      isPreparingRef.current = false;
    }
  }, [playingAudio, content, tts, audioFileId, teardownPlayback]);

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );
  }, []);

  if (role === 'user') {
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
  } else if (role === 'assistant') {
    const metrics: string[] = [];
    if (typeof tokensPerSecond === 'number') {
      metrics.push(`${tokensPerSecond.toFixed(1)} tok/s`);
    }
    if (typeof timeToFirstToken === 'number') {
      metrics.push(formatTimeToFirstToken(timeToFirstToken));
    }

    const accentColor = copied ? colors.primary : colors.onSurfaceVariant;
    const isAwaitingResponse =
      isStreaming && content.length === 0 && toolInvocations.length === 0;
    const isThinkingActive = isStreaming && !isThinkingComplete;
    const hasSpokenText = stripThinkingBlocks(content) !== '';
    const canCopyAssistantText = hasSpokenText && !isStreaming;
    // Only offer playback once a TTS engine is actually loaded and ready,
    // otherwise the button would be a no-op.
    const canPlayAudio =
      hasSpokenText && !isStreaming && ttsState === AiModelState.Ready;

    return (
      <View style={styles.assistantContainer}>
        {isAwaitingResponse ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.loadingIndicator}
          />
        ) : (
          <>
            {thinking !== null && (
              <ThinkingBlock
                thinking={thinking}
                active={isThinkingActive}
                onPress={() => setThinkingOpen(true)}
              />
            )}
            {toolInvocations.map((invocation, index) => (
              <ToolCallBlock
                key={`${invocation.name}-${index}`}
                name={invocation.name}
                arguments={invocation.arguments}
                onPress={() => setOpenToolIndex(index)}
              />
            ))}
            {rest.length > 0 &&
              (isStreaming ? (
                <StreamdownText
                  containerStyle={styles.streamdownContainer}
                  markdown={rest}
                  markdownStyle={markdownStyle}
                  onLinkPress={handleLinkPress}
                />
              ) : (
                <EnrichedMarkdownText
                  containerStyle={styles.streamdownContainer}
                  markdown={rest}
                  markdownStyle={markdownStyle}
                  onLinkPress={handleLinkPress}
                />
              ))}
          </>
        )}
        {content.length > 0 && (
          <View style={styles.footerContainer}>
            {canCopyAssistantText && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('components.messageListItem.copy')}
                hitSlop={8}
                onPress={handleCopy}
                style={({ pressed }) => [pressed && styles.buttonPressed]}
              >
                <PlatformIcon
                  iosIconName={copied ? 'checkmark' : 'doc.on.doc'}
                  androidIconName={copied ? 'check' : 'content_copy'}
                  size={16}
                  color={accentColor}
                />
              </Pressable>
            )}
            {canPlayAudio && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('components.messageListItem.playAudio')}
                hitSlop={8}
                onPress={handlePlayAudio}
                style={({ pressed }) => [pressed && styles.buttonPressed]}
              >
                <PlatformIcon
                  iosIconName={playingAudio ? 'pause' : 'speaker.wave.2'}
                  androidIconName={playingAudio ? 'pause' : 'volume_up'}
                  size={16}
                  color={accentColor}
                />
              </Pressable>
            )}
            {metrics.length > 0 && (
              <Text
                variant="caption"
                style={[styles.metricsText, { color: colors.onSurfaceVariant }]}
              >
                {metrics.join(' · ')}
              </Text>
            )}
          </View>
        )}
        {thinking !== null && (
          <ThinkingModal
            thinking={thinkingOpen ? thinking : null}
            active={isThinkingActive}
            onClose={() => setThinkingOpen(false)}
          />
        )}
        {openToolIndex !== null && toolInvocations[openToolIndex] && (
          <ToolCallModal
            name={toolInvocations[openToolIndex].name}
            arguments={toolInvocations[openToolIndex].arguments}
            result={toolInvocations[openToolIndex].result}
            visible
            onClose={() => setOpenToolIndex(null)}
          />
        )}
      </View>
    );
  } else if (role === 'system') {
    return (
      <View style={styles.assistantContainer}>
        <SystemBlock content={content} />
      </View>
    );
  }

  return null;
};

export { MessageListItem };
