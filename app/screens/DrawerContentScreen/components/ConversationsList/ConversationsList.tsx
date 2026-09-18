import React, { useCallback, FC } from 'react';
import { FlatList, ListRenderItem, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'components';
import { setAppState } from 'database';
import { useAppState, useConversations, useStyled } from 'hooks';
import { capitalize } from 'helpers';
import { Conversation } from 'types';

import styles from './ConversationsList.styles';

interface ConversationsListProps {
  onCloseDrawer: () => void;
  /**
   * Room to leave below the last conversation, so it can be scrolled clear of
   * whatever floats over the bottom of the drawer. Without it the last items
   * come to rest underneath the New chat button, which sits on top of this list
   * and takes their taps.
   */
  bottomInset?: number;
}

export const ConversationsList: FC<ConversationsListProps> = ({
  onCloseDrawer,
  bottomInset = 0,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { conversations } = useConversations();
  const { conversationIdInUse } = useAppState();

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      setAppState({
        modelIdInUse: conversation.modelId,
        conversationIdInUse: conversation.id,
      });
      onCloseDrawer();
    },
    [onCloseDrawer],
  );

  const renderItem = useCallback<ListRenderItem<Conversation>>(
    ({ item }) => (
      <Pressable
        onPress={() => handleConversationPress(item)}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: pressed ? colors.surfaceContainer : 'transparent',
          },
        ]}
      >
        <Text
          style={[styles.itemText, { color: colors.onSurface }]}
          numberOfLines={1}
          bold={item.id === conversationIdInUse}
        >
          {capitalize(item.title)}
        </Text>
      </Pressable>
    ),
    [
      colors.surfaceContainer,
      colors.onSurface,
      conversationIdInUse,
      handleConversationPress,
    ],
  );

  return (
    <>
      <Text style={[styles.header, { color: colors.onSurfaceVariant }]}>
        {t('components.conversationsList.recent')}
      </Text>
      <FlatList
        style={styles.listContainer}
        contentContainerStyle={[
          styles.contentContainerStyle,
          { paddingBottom: bottomInset },
        ]}
        // Keeps the scroll bar itself out from under the button too (iOS).
        scrollIndicatorInsets={{ bottom: bottomInset }}
        data={conversations}
        keyExtractor={conversation => conversation.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.onSurface }]}>
            {t('components.conversationsList.noConversations')}
          </Text>
        }
      />
    </>
  );
};
