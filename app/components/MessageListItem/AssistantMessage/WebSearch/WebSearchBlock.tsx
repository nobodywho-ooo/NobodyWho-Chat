import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics } from 'helpers';
import { useStyled } from 'hooks';
import {
  buildRows,
  openExternalUrl,
  useWebSearchStore,
  type WebSearchTraceEntry,
} from 'services';
import { Spacings } from 'style';
import type { WebSource } from 'types';

import { Chevron } from '../../../Chevron/Chevron';
import { PlatformIcon } from '../../../PlatformIcon/PlatformIcon';
import { Text } from '../../../Text/Text';

import {
  ROW_HEIGHT,
  ROW_INDENT,
  STAGGER_MS,
  WEB_TRACE_TRANSITION_MS,
} from './constants';
import { WebSearchTraceList } from './WebSearchTraceList';
import { WebSearchTraceRow } from './WebSearchTraceRow';

const EMPTY_TRACE: WebSearchTraceEntry[] = [];

interface WebSearchBlockProps {
  // The streaming turn shows the live trace from the store; a finished one
  // only its persisted sources.
  live: boolean;
  sources: WebSource[];
}

// "Searching the web…" while a search runs — the newest step pinned under the
// header, the rest folded into an accordion — then "Searched the web" with the
// pages it read, each opening in the browser.
export const WebSearchBlock: React.FC<WebSearchBlockProps> = ({
  live,
  sources,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const isSearching = useWebSearchStore(state => live && state.isSearchingWeb);
  const trace = useWebSearchStore(state =>
    live ? state.webSearchTrace : EMPTY_TRACE,
  );
  const challengeActive = useWebSearchStore(
    state => isSearching && state.challengeActive,
  );
  const liveExpanded = useWebSearchStore(state => live && state.traceExpanded);
  const setTraceExpanded = useWebSearchStore(state => state.setTraceExpanded);
  const openChallenge = useWebSearchStore(state => state.openChallenge);
  const [localExpanded, setLocalExpanded] = useState(false);

  const isLiveBlock = live && (isSearching || trace.length > 0);
  const expanded = isLiveBlock ? liveExpanded : localExpanded;

  useEffect(() => {
    if (isLiveBlock) {
      setLocalExpanded(liveExpanded);
    }
  }, [isLiveBlock, liveExpanded]);

  const rows = useMemo(
    () => buildRows(isSearching, trace, sources, challengeActive),
    [isSearching, trace, sources, challengeActive],
  );

  // Rows already shown appear at once on re-expand; only new ones stagger in.
  const seenKeys = useRef<Set<string>>(new Set());
  const enterDelay = useMemo(() => {
    const delays = new Map<string, number>();
    let fresh = 0;
    for (const row of rows) {
      if (seenKeys.current.has(row.key)) {
        delays.set(row.key, 0);
      } else {
        delays.set(row.key, fresh * STAGGER_MS);
        fresh += 1;
      }
    }
    return delays;
  }, [rows]);

  useEffect(() => {
    if (!expanded) {
      seenKeys.current.clear();
      return;
    }
    for (const row of rows) {
      seenKeys.current.add(row.key);
    }
  }, [expanded, rows]);

  const [listMounted, setListMounted] = useState(false);

  useEffect(() => {
    if (expanded) {
      setListMounted(true);
    }
  }, [expanded]);

  const isSearchingRef = useRef(isSearching);
  isSearchingRef.current = isSearching;

  const handleCollapsed = useCallback(() => {
    if (isSearchingRef.current) {
      setListMounted(false);
    }
  }, []);

  if (rows.length === 0 && !isSearching) {
    return null;
  }

  const title = (() => {
    if (isSearching) {
      return trace.some(entry => entry.type === 'searching')
        ? t('components.webSearch.searching')
        : t('components.webSearch.planning');
    }
    if (trace.some(entry => entry.type === 'offline')) {
      return t('components.webSearch.offline');
    }
    if (trace.some(entry => entry.type === 'skipped')) {
      return t('components.webSearch.skipped');
    }
    return t('components.webSearch.searched');
  })();

  const currentRow = isSearching ? rows[rows.length - 1] : undefined;
  const listRows = isSearching ? rows.slice(0, -1) : rows;
  const listVisible = listMounted && listRows.length > 0;

  const toggleExpanded = () => {
    haptics.light();
    if (isLiveBlock) {
      setTraceExpanded(!expanded);
    } else {
      setLocalExpanded(previous => !previous);
    }
  };

  return (
    <Animated.View
      style={styles.container}
      layout={
        isSearching
          ? LinearTransition.duration(WEB_TRACE_TRANSITION_MS)
          : undefined
      }
    >
      <Pressable
        style={styles.header}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="web-search-block"
      >
        <PlatformIcon
          iosIconName="globe"
          androidIconName="language"
          size={14}
          color={colors.onSurfaceVariant}
        />
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.title, { color: colors.onSurfaceVariant }]}
          testID="web-search-title"
        >
          {title}
        </Text>
        {rows.length > 0 && (
          <Chevron
            expanded={expanded}
            color={colors.onSurfaceVariant}
            size={12}
          />
        )}
      </Pressable>

      {listVisible && (
        <WebSearchTraceList
          expanded={expanded}
          rows={listRows}
          enterDelay={enterDelay}
          animateRows={isSearching}
          continuesBelow={isSearching}
          onOpen={openExternalUrl}
          onOpenChallenge={openChallenge}
          onCollapsed={handleCollapsed}
        />
      )}
      {currentRow && (
        <Animated.View
          style={[
            styles.currentSlot,
            listVisible && styles.currentSlotAttached,
          ]}
          exiting={FadeOut.duration(160)}
        >
          <Animated.View
            key={currentRow.key}
            style={styles.currentRow}
            entering={FadeIn.duration(WEB_TRACE_TRANSITION_MS)}
            exiting={FadeOut.duration(200)}
          >
            <WebSearchTraceRow
              row={currentRow}
              isFirst={!listVisible}
              isLast
              onOpen={openExternalUrl}
              onOpenChallenge={openChallenge}
            />
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacings.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    paddingVertical: Spacings.xxs,
  },
  title: {
    flexShrink: 1,
  },
  currentSlot: {
    marginTop: Spacings.xs,
    height: ROW_HEIGHT,
  },
  currentSlotAttached: {
    marginTop: 0,
  },
  currentRow: {
    position: 'absolute',
    left: ROW_INDENT,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
