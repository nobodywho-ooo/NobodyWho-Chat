import React, { useCallback, useRef } from 'react';
import { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useDrawerScrollGesture } from 'hooks';

import styles from './ModelsTabs.styles';
import { TabPill } from './TabPill';

export type ModelsTab = 'discover' | 'recommended' | 'inUse' | 'downloaded';

const TABS: readonly { tab: ModelsTab; labelKey: string }[] = [
  { tab: 'discover', labelKey: 'screens.models.discover' },
  { tab: 'recommended', labelKey: 'screens.models.recommended' },
  { tab: 'inUse', labelKey: 'screens.models.inUse' },
  { tab: 'downloaded', labelKey: 'screens.models.downloaded' },
];

interface ModelsTabsProps {
  selected: ModelsTab;
  onSelect: (tab: ModelsTab) => void;
}

export const ModelsTabs: React.FC<ModelsTabsProps> = ({
  selected,
  onSelect,
}) => {
  const { t } = useTranslation();
  const onScrollGesture = useDrawerScrollGesture();

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewportWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const pillLayoutsRef = useRef<Partial<Record<ModelsTab, LayoutRectangle>>>(
    {},
  );

  const scrollToTab = useCallback((tab: ModelsTab) => {
    const layout = pillLayoutsRef.current[tab];
    const maxX = contentWidthRef.current - viewportWidthRef.current;
    if (!layout || maxX <= 0) {
      return;
    }
    const centeredX =
      layout.x + layout.width / 2 - viewportWidthRef.current / 2;
    scrollRef.current?.scrollTo({
      x: Math.min(Math.max(centeredX, 0), maxX),
      animated: true,
    });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(event: LayoutChangeEvent) => {
        viewportWidthRef.current = event.nativeEvent.layout.width;
      }}
      onContentSizeChange={(width: number) => {
        contentWidthRef.current = width;
      }}
      onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={onScrollGesture}
      horizontal
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsHorizontalScrollIndicator={false}
    >
      {TABS.map(({ tab, labelKey }) => (
        <TabPill
          key={tab}
          label={t(labelKey)}
          selected={tab === selected}
          onLayout={event => {
            pillLayoutsRef.current[tab] = event.nativeEvent.layout;
          }}
          onPress={() => {
            scrollToTab(tab);
            onSelect(tab);
          }}
        />
      ))}
    </ScrollView>
  );
};
