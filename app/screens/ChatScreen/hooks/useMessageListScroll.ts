import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  type AnchoredEndSpaceConfig,
  type LegendListRef,
} from '@legendapp/list/react-native';
import {
  useKeyboardChatComposerInset,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard';
import { KeyboardController } from 'react-native-keyboard-controller';
import { Spacings } from 'style';
import { DisplayMessage } from 'types';

import { UserMessage } from '../../../components/MessageListItem/UserMessage/UserMessage';

const ANCHOR_OFFSET = Spacings.md; // Breathing room between the header and the message parked at the top of the list

const ANCHOR_MAX_LINES = 2;

const ANCHOR_MAX_SIZE =
  ANCHOR_MAX_LINES * UserMessage.LINE_HEIGHT +
  2 * UserMessage.BUBBLE_PADDING_VERTICAL +
  2 * UserMessage.ROW_MARGIN_VERTICAL;

const BOTTOM_OFFSET = 10_000_000; // Further than any conversation is tall; the list clamps it to however far it can actually go

const EDGE_EPSILON = 1; // Sub-pixel rounding between measured rows and the scroll offset

type ListState = ReturnType<LegendListRef['getState']>;

// Whether the bottom of the newest message is visible above whatever covers the end of the list (composer, keyboard).
// This is a different question from the list's own isAtEnd, which also counts the blank space reserved under a parked message:
// - with a sent message longer than the anchor cap, that space reaches past the screen, so the list reads "not at end" while the whole conversation is on screen.
// - on Android the end inset it uses comes back from the native scroll view a few frames late, so every time the space shrinks under a new line of the answer
//   the list reads "not at end" for those frames, and the chevron flashes.
const isLastRowInView = (
  state: ListState,
  topInset: number,
  coveredEnd: number,
) => {
  const lastIndex = state.data.length - 1;

  if (lastIndex < 0) {
    return false;
  }

  const top = state.positionAtIndex(lastIndex);
  const size = state.sizeAtIndex(lastIndex);

  if (top === undefined || size === undefined) {
    return false;
  }

  const visibleEnd = state.scroll + state.scrollLength - coveredEnd;

  return topInset + top + size <= visibleEnd + EDGE_EPSILON;
};

// topInset: how much of the list sits under a transparent header, so the parked message lands below it rather than behind it.
// keyboardOffset: how much of the keyboard's height the composer does not rise by (the bottom safe area it already sits above).
export const useMessageListScroll = (
  messages: DisplayMessage[],
  topInset = 0,
  keyboardOffset = 0,
) => {
  const anchorOffset = ANCHOR_OFFSET + topInset;

  const listRef = useRef<LegendListRef>(null);
  const composerRef = useRef<React.ComponentRef<typeof View>>(null);

  const [anchorIndex, setAnchorIndex] = useState<number | undefined>(undefined); // Index of the sent message parked at the top of the list
  const [following, setFollowing] = useState(false);
  const [atEnd, setAtEnd] = useState(true); // Whether the end of the conversation is in view, which is what decides if the scroll-to-bottom chevron is offered.

  const { contentInsetEndAdjustment, onComposerLayout } =
    useKeyboardChatComposerInset(listRef, composerRef);
  const { freeze } = useKeyboardScrollToEnd({ listRef });

  useEffect(() => {
    const list = listRef.current;

    if (anchorIndex === undefined || list === null) {
      return;
    }

    freeze.set(true);
    const release = () => freeze.set(false);
    list
      .scrollToIndex({
        index: anchorIndex,
        viewPosition: 0,
        viewOffset: anchorOffset,
        animated: anchorIndex > 0,
      })
      .then(release, release);
  }, [anchorIndex, anchorOffset, freeze]);

  // Only the list's signal is trusted for "at end": a reading taken before it has laid out says "not at end".
  // When it says "not at end", the chevron is still held back while the newest message is fully in view.
  const listAtEndRef = useRef(true);

  const refreshAtEnd = useCallback(() => {
    const list = listRef.current;

    if (listAtEndRef.current || list === null) {
      setAtEnd(true);

      return;
    }

    const keyboardLift = Math.max(
      0,
      KeyboardController.state().height - keyboardOffset,
    );

    const coveredEnd = contentInsetEndAdjustment.value + keyboardLift;
    setAtEnd(isLastRowInView(list.getState(), topInset, coveredEnd));
  }, [contentInsetEndAdjustment, keyboardOffset, topInset]);

  useEffect(() => {
    const state = listRef.current?.getState();

    if (!state) {
      return;
    }

    const unsubscribes = [
      state.listen('isAtEnd', isAtEnd => {
        listAtEndRef.current = isAtEnd;
        refreshAtEnd();
      }),
      state.listen('totalSize', refreshAtEnd),
    ];

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [refreshAtEnd]);

  // Scrolling away from the end only flips the list's signal once; the newest message leaving the screen is seen here.
  const onScroll = useCallback(() => {
    if (!listAtEndRef.current) {
      refreshAtEnd();
    }
  }, [refreshAtEnd]);

  const scrollingToBottomRef = useRef(false);
  const missedScrollToBottomRef = useRef(false);
  const replayFrameRef = useRef<number | undefined>(undefined);

  const scrollToBottomNow = useCallback(function runScrollToBottom(
    animated: boolean,
  ) {
    if (scrollingToBottomRef.current) {
      missedScrollToBottomRef.current = true;
      return;
    }

    scrollingToBottomRef.current = true;

    try {
      listRef.current?.scrollToOffset({ offset: BOTTOM_OFFSET, animated });
    } finally {
      scrollingToBottomRef.current = false;
    }

    if (missedScrollToBottomRef.current) {
      missedScrollToBottomRef.current = false;
      replayFrameRef.current = requestAnimationFrame(() => {
        replayFrameRef.current = undefined;
        runScrollToBottom(animated);
      });
    }
  }, []);

  useEffect(
    () => () => {
      if (replayFrameRef.current !== undefined) {
        cancelAnimationFrame(replayFrameRef.current);
        replayFrameRef.current = undefined;
      }
    },
    [],
  );

  const streamedContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (!following) {
      return;
    }
    scrollToBottomNow(false);
  }, [following, streamedContent, scrollToBottomNow]);

  useEffect(() => {
    if (!following) {
      return;
    }
    return listRef.current
      ?.getState()
      .listen('totalSize', () => scrollToBottomNow(false));
  }, [following, scrollToBottomNow]);

  const anchorSentMessage = useCallback((index: number) => {
    setFollowing(false);
    setAnchorIndex(index);
  }, []);

  const scrollToBottom = useCallback(() => {
    setAnchorIndex(undefined);
    setFollowing(true);
    scrollToBottomNow(true);
  }, [scrollToBottomNow]);

  const onScrollBeginDrag = useCallback(() => setFollowing(false), []);

  const showConversation = useCallback(() => {
    setAnchorIndex(undefined);
    setFollowing(false);
    listAtEndRef.current = true;
    setAtEnd(true);
    listRef.current?.clearCaches({ mode: 'sizes' });
    scrollToBottomNow(false);
  }, [scrollToBottomNow]);

  const anchorHasAttachment =
    anchorIndex !== undefined &&
    (messages[anchorIndex]?.documentsPath?.length ?? 0) > 0;

  const anchoredEndSpace: AnchoredEndSpaceConfig | undefined =
    anchorIndex === undefined
      ? undefined
      : {
          anchorIndex,
          anchorMaxSize: anchorHasAttachment ? undefined : ANCHOR_MAX_SIZE,
          anchorOffset,
        };

  return {
    listRef,
    composerRef,
    onComposerLayout,
    contentInsetEndAdjustment,
    freeze,
    anchoredEndSpace,
    maintainVisibleContentPosition: anchorIndex !== undefined,
    onScrollBeginDrag,
    onScroll,
    canScrollToBottom: !atEnd && !following,
    anchorSentMessage,
    scrollToBottom,
    showConversation,
  };
};

export type MessageListScroll = ReturnType<typeof useMessageListScroll>;
