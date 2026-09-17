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

export const useMessageListScroll = (messages: DisplayMessage[]) => {
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
        viewOffset: ANCHOR_OFFSET,
        animated: anchorIndex > 0,
      })
      .then(release, release);
  }, [anchorIndex, freeze]);

  useEffect(() => listRef.current?.getState().listen('isAtEnd', setAtEnd), []);

  const scrollingToBottomRef = useRef(false);
  const missedScrollToBottomRef = useRef(false);

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
      requestAnimationFrame(() => runScrollToBottom(animated));
    }
  }, []);

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
          anchorOffset: ANCHOR_OFFSET,
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
    canScrollToBottom: !atEnd && !following,
    anchorSentMessage,
    scrollToBottom,
    showConversation,
  };
};

export type MessageListScroll = ReturnType<typeof useMessageListScroll>;
