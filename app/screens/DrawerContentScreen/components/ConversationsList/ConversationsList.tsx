import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'components';
import { useChats, useStyled } from 'hooks';

export const ConversationsList = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { chats } = useChats();

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.header, { color: colors.onSurfaceVariant }]}>
        {t('components.conversationsList.conversations')}
      </Text>
      {chats.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.onSurface }]}>
          {t('components.conversationsList.noConversations')}
        </Text>
      )}
      {chats.map(chat => (
        <Pressable
          key={chat.id}
          style={({ pressed }) => [
            styles.item,
            {
              backgroundColor: pressed
                ? colors.surfaceContainer
                : 'transparent',
            },
          ]}
        >
          <Text
            style={[styles.itemText, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {chat.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
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
