import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useDrawerScrollGesture } from 'hooks';

import styles from './ModelsTabs.styles';
import { TabPill } from './TabPill';

export type ModelsTab = 'discover' | 'inUse' | 'downloaded';

const TABS: readonly { tab: ModelsTab; labelKey: string }[] = [
  { tab: 'discover', labelKey: 'screens.models.discover' },
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

  return (
    <ScrollView
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
          onPress={() => onSelect(tab)}
        />
      ))}
    </ScrollView>
  );
};
