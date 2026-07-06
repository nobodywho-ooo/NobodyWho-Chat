import React, { createRef, useMemo } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { ChatPipeline } from 'types';

import { MessageStarter } from './MessageStarter';
import { pickStarterIds } from './starters';
import styles from './MessageStarters.styles';

// The DrawerNavigator makes its swipe pan requireExternalGestureToFail on this
// ref; only one MessageStarters is ever mounted, so a module-level ref is safe.
export const messageStartersScrollRef = createRef<ScrollView>();

interface MessageStartersProps {
  pipeline: ChatPipeline;
  onSelect: (body: string) => void;
}

export const MessageStarters: React.FC<MessageStartersProps> = ({
  pipeline,
  onSelect,
}) => {
  const { t } = useTranslation();
  const starterIds = useMemo(() => pickStarterIds(pipeline), [pipeline]);

  return (
    <ScrollView
      ref={messageStartersScrollRef}
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
        />
      ))}
    </ScrollView>
  );
};
