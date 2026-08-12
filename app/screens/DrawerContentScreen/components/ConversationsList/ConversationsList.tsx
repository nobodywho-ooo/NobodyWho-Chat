import React, { useCallback } from 'react';
import { FlatList, ListRenderItem, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'components';
import { setAppState } from 'database';
import { useAppState, useConversations, useStyled } from 'hooks';
import { capitalize, haptics } from 'helpers';
import { Conversation } from 'types';

import styles from './ConversationsList.styles';

interface ConversationsListProps {
  onCloseDrawer: () => void;
}

export const ConversationsList: React.FC<ConversationsListProps> = ({
  onCloseDrawer,
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
      haptics.medium();
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
        contentContainerStyle={styles.contentContainerStyle}
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
