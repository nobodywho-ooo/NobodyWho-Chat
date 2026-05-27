import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'components';
import { useStyled } from 'hooks';

const FAKE_CONVERSATIONS = [
  'How to cook pasta al dente like an italian and italian love',
  'Explain quantum computing',
  'Trip planning for Japan',
  'Debug my Python script',
  'Weekly grocery list ideas',
  'Summarize this research paper',
  'Help me write a cover letter',
];

export const ConversationList = () => {
  const { colors } = useStyled();

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.header, { color: colors.onSurfaceVariant }]}>
        Conversations
      </Text>
      {FAKE_CONVERSATIONS.map(title => (
        <Pressable
          key={title}
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
            {title}
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
});
