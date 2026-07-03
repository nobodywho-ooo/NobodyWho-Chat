import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AssistantConfig,
  DEFAULT_ASSISTANT_CONFIG,
  getAppState,
  setAppState,
} from 'database';
import { useStyled } from 'hooks';
import { IconButton, Slider, Text } from 'components';

import styles from './CustomizeAssistantScreen.styles';

export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const TEMPERATURE_STEP = 0.1;
export const TOKENS_MIN = 500;
export const TOKENS_MAX = 8000;
export const TOKENS_STEP = 500;

export const CustomizeAssistantScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const [config, setConfig] = useState<AssistantConfig>(
    () => getAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG,
  );

  const setLocal = useCallback((patch: Partial<AssistantConfig>) => {
    setConfig(current => ({ ...current, ...patch }));
  }, []);

  const savePreference = useCallback((patch: Partial<AssistantConfig>) => {
    setConfig(current => {
      const newAssistantConfig = { ...current, ...patch };
      setAppState({ assistantConfig: newAssistantConfig });
      return newAssistantConfig;
    });
  }, []);

  // Closing the screen mid-edit must not lose the pending changes
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(
    () => () => {
      setAppState({ assistantConfig: configRef.current });
    },
    [],
  );

  const switchColors = {
    trackColor: { true: colors.primary },
    thumbColor: '#FFFFFF',
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text bold>{t('screens.customizeAssistant.temperature')}</Text>
      <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
        {t('screens.customizeAssistant.temperatureSubtitle')}
      </Text>
      <View style={styles.sliderRowContainer}>
        <View style={styles.sliderContainer}>
          <Slider
            value={config.temperature}
            minimumValue={TEMPERATURE_MIN}
            maximumValue={TEMPERATURE_MAX}
            step={TEMPERATURE_STEP}
            onValueChange={temperature => setLocal({ temperature })}
            onSlidingComplete={temperature => savePreference({ temperature })}
          />
        </View>
        <Text bold style={styles.sliderValue}>
          {config.temperature.toFixed(1)}
        </Text>
      </View>

      <Text bold style={styles.sectionHeader}>
        {t('screens.customizeAssistant.systemPrompt')}
      </Text>
      <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
        {t('screens.customizeAssistant.systemPromptSubtitle')}
      </Text>
      <TextInput
        style={[
          styles.systemPromptInput,
          { borderColor: colors.border, color: colors.onSurface },
        ]}
        multiline
        value={config.systemPrompt}
        placeholder={t('screens.customizeAssistant.systemPromptPlaceholder')}
        placeholderTextColor={colors.onSurfaceVariant}
        onChangeText={systemPrompt => setLocal({ systemPrompt })}
        onEndEditing={() => savePreference({})}
      />

      <View style={styles.switchRowContainer}>
        <View style={styles.switchLabel}>
          <Text bold>{t('screens.customizeAssistant.thinking')}</Text>
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('screens.customizeAssistant.thinkingSubtitle')}
          </Text>
        </View>
        <View style={styles.switchContainer}>
          <Switch
            {...switchColors}
            value={config.thinking}
            onValueChange={thinking => savePreference({ thinking })}
          />
        </View>
      </View>

      <View style={styles.switchRowContainer}>
        <View style={styles.switchLabel}>
          <Text bold>{t('screens.customizeAssistant.toolCalling')}</Text>
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('screens.customizeAssistant.toolCallingSubtitle')}
          </Text>
        </View>
        <View style={styles.switchContainer}>
          <Switch
            {...switchColors}
            value={config.toolCalling}
            onValueChange={toolCalling => savePreference({ toolCalling })}
          />
        </View>
      </View>

      <View style={styles.tokenRowContainer}>
        <View style={styles.tokenLabel}>
          <Text bold>{t('screens.customizeAssistant.maxTokens')}</Text>
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('screens.customizeAssistant.maxTokensSubtitle')}
          </Text>
        </View>
        <View style={styles.stepperContainer}>
          <IconButton
            icon={{ iosIconName: 'minus', androidIconName: 'remove' }}
            accessibilityLabel={t(
              'screens.customizeAssistant.decreaseMaxTokens',
            )}
            disabled={config.maxTokens <= TOKENS_MIN}
            color={
              config.maxTokens <= TOKENS_MIN
                ? colors.onSurfaceDisabled
                : colors.onSurface
            }
            onPress={() =>
              savePreference({
                maxTokens: Math.max(config.maxTokens - TOKENS_STEP, TOKENS_MIN),
              })
            }
          />
          <Text bold style={styles.stepperValue}>
            {config.maxTokens}
          </Text>
          <IconButton
            icon={{ iosIconName: 'plus', androidIconName: 'add' }}
            accessibilityLabel={t(
              'screens.customizeAssistant.increaseMaxTokens',
            )}
            disabled={config.maxTokens >= TOKENS_MAX}
            color={
              config.maxTokens >= TOKENS_MAX
                ? colors.onSurfaceDisabled
                : colors.onSurface
            }
            onPress={() =>
              savePreference({
                maxTokens: Math.min(config.maxTokens + TOKENS_STEP, TOKENS_MAX),
              })
            }
          />
        </View>
      </View>
    </ScrollView>
  );
};
