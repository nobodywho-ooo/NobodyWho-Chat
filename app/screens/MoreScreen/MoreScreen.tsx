import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { ListItem } from 'components';
import { AiModelState, useAiService } from 'services';

import styles from './MoreScreen.styles';

export const MoreScreen: React.FC = () => {
  const { colors } = useStyled();
  const navigation = useNavigation();
  const { encoderState, crossEncoderState, createEncoder, createCrossEncoder } =
    useAiService();

  useEffect(() => {
    createEncoder();
    createCrossEncoder();
  }, [createEncoder, createCrossEncoder]);

  const isLoading =
    encoderState === AiModelState.Loading ||
    crossEncoderState === AiModelState.Loading;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {isLoading ? (
        <ActivityIndicator size="large" style={styles.spinner} />
      ) : (
        <>
          <ListItem
            title="Embeddings"
            subtitle="Use embeddings to find the relevant documents"
            iosIconName="document.fill"
            androidIconName="article"
            iconBackgroundColor="#5856D6"
            disabled={encoderState === AiModelState.Error}
            // @ts-ignore
            onPress={() => navigation.navigate('EmbeddingsScreen')}
          />
          <ListItem
            title="RAG"
            subtitle="Demonstrate a two-stage retrieval system using RAG"
            iosIconName="magnifyingglass"
            androidIconName="search"
            iconBackgroundColor="#FF9500"
            disabled={crossEncoderState === AiModelState.Error}
            // @ts-ignore
            onPress={() => navigation.navigate('RagScreen')}
          />
        </>
      )}
    </ScrollView>
  );
};
