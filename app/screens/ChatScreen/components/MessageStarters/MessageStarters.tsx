import React, { useEffect, useMemo } from 'react';
import { ScrollView, type NativeGesture } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { ChatPipeline } from 'types';

import { MessageStarter } from './MessageStarter';
import { pickStarterIds } from './starters';
import styles from './MessageStarters.styles';

// The DrawerNavigator's swipe pan is told to `requireToFail` this ScrollView's
// scroll gesture (RNGH 3 relations take a gesture, not a ref). RNGH surfaces the
// gesture through the ScrollView's onGestureUpdate callback, so we publish it
// through a tiny external store the DrawerCoordination subscribes to. Only one
// MessageStarters is ever mounted, so a module-level store is safe.
let currentScrollGesture: NativeGesture | null = null;
const scrollGestureListeners = new Set<() => void>();

export const scrollGestureStore = {
  subscribe: (listener: () => void) => {
    scrollGestureListeners.add(listener);
    return () => {
      scrollGestureListeners.delete(listener);
    };
  },
  getSnapshot: () => currentScrollGesture,
  set: (gesture: NativeGesture | null) => {
    if (gesture === currentScrollGesture) {
      return;
    }
    currentScrollGesture = gesture;
    scrollGestureListeners.forEach(listener => listener());
  },
};

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

  // The captured gesture's handler dies with the ScrollView, so clear it on
  // unmount to stop the drawer pan waiting on a stale handler.
  useEffect(() => () => scrollGestureStore.set(null), []);

  return (
    <ScrollView
      onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={gesture =>
        scrollGestureStore.set(gesture)
      }
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
