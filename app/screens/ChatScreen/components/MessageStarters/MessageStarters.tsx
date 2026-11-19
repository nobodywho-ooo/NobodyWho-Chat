import React, { useMemo } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useDrawerScrollGesture } from 'hooks';
import { ChatPipeline } from 'types';

import { MessageStarter } from './MessageStarter';
import { pickStarterIds } from './starters';
import styles from './MessageStarters.styles';

interface MessageStartersProps {
  pipeline: ChatPipeline;
  onSelect: (body: string) => void;
  disabled?: boolean;
}

export const MessageStarters: React.FC<MessageStartersProps> = ({
  pipeline,
  onSelect,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const starterIds = useMemo(() => pickStarterIds(pipeline), [pipeline]);

  // Lets the drawer swipe wait for this row's scroll (Android).
  const onScrollGesture = useDrawerScrollGesture();

  return (
    <ScrollView
      onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={onScrollGesture}
      horizontal
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {starterIds.map(id => (
        <MessageStarter
          key={id}
          title={t(`components.messageStarters.${id}.title`)}
          subtitle={t(`components.messageStarters.${id}.subtitle`)}
          body={t(`components.messageStarters.${id}.body`)}
          onPress={onSelect}
          disabled={disabled}
        />
      ))}
    </ScrollView>
  );
};
