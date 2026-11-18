import React from 'react';
import { View } from 'react-native';
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import type { AttributedBlock } from 'services';

import { WebSourceBadge } from './WebSearch';

import styles from './AssistantMessage.styles';

interface AnswerBodyProps {
  text: string;
  isStreaming: boolean;
  blocks: AttributedBlock[] | null;
  markdownStyle: MarkdownStyle;
  onLinkPress: (event: { url: string }) => void;
}

export const AnswerBody: React.FC<AnswerBodyProps> = ({
  text,
  isStreaming,
  blocks,
  markdownStyle,
  onLinkPress,
}) => {
  if (text.length === 0) {
    return null;
  }

  if (isStreaming) {
    return (
      <StreamdownText
        containerStyle={styles.streamdownContainer}
        flavor="github"
        markdown={text}
        markdownStyle={markdownStyle}
        onLinkPress={onLinkPress}
      />
    );
  }

  return (
    <>
      {(blocks ?? [{ text, source: null }]).map((block, index) => (
        <View key={`${index}-${block.source?.url ?? 'none'}`}>
          <EnrichedMarkdownText
            containerStyle={styles.streamdownContainer}
            flavor="github"
            markdown={block.text}
            markdownStyle={markdownStyle}
            onLinkPress={onLinkPress}
          />
          {block.source && <WebSourceBadge source={block.source} />}
        </View>
      ))}
    </>
  );
};
