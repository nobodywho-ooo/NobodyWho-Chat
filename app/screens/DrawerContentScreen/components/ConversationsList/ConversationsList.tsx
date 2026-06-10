import React, { useCallback } from 'react';
import { FlatList, ListRenderItem, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'components';
import { setAppState } from 'database';
import { useAppState, useConversations, useStyled } from 'hooks';
import { Conversation } from 'types';

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
          {item.title}
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
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={conversations}
      keyExtractor={conversation => conversation.id.toString()}
      renderItem={renderItem}
      ListHeaderComponent={
        <Text style={[styles.header, { color: colors.onSurfaceVariant }]}>
          {t('components.conversationsList.conversations')}
        </Text>
      }
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.onSurface }]}>
          {t('components.conversationsList.noConversations')}
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
  },
  header: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  itemText: {
    fontSize: 15,
  },
  emptyText: {
    paddingHorizontal: 16,
  },
});
