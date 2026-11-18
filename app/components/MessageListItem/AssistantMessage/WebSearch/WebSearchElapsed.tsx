import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';

import { Text } from '../../../Text/Text';

const TICK_MS = 1000;

const wholeSecondsSince = (startedAt: number): number =>
  Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

interface WebSearchElapsedProps {
  startedAt: number;
}

export const WebSearchElapsed: React.FC<WebSearchElapsedProps> = ({
  startedAt,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const [seconds, setSeconds] = useState(() => wholeSecondsSince(startedAt));

  useEffect(() => {
    setSeconds(wholeSecondsSince(startedAt));
    const interval = setInterval(
      () => setSeconds(wholeSecondsSince(startedAt)),
      TICK_MS,
    );
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <Text
      variant="caption"
      style={[styles.elapsed, { color: colors.onSurfaceVariant }]}
      accessibilityLiveRegion="none"
      testID="web-search-elapsed"
    >
      {t('components.messageListItem.elapsed', { seconds })}
    </Text>
  );
};

const styles = StyleSheet.create({
  elapsed: {
    fontVariant: ['tabular-nums'],
  },
});
