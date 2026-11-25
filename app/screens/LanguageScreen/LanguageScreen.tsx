import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  APP_LANGUAGES,
  APP_LANGUAGE_NAMES,
  AppLanguage,
  getDeviceLanguage,
  getLanguagePreference,
  setLanguagePreference,
} from 'i18n';
import { useStyled } from 'hooks';
import { HeaderScrollView, PlatformIcon, Text } from 'components';
import { Spacings } from 'style';

import styles from './LanguageScreen.styles';

interface LanguageRowProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}

const LanguageRow: React.FC<LanguageRowProps> = ({
  title,
  subtitle,
  selected,
  onPress,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.checkmark}>
        {selected && (
          <PlatformIcon
            iosIconName="checkmark"
            androidIconName="check"
            color={colors.primary}
          />
        )}
      </View>
    </Pressable>
  );
};

export const LanguageScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const [preference, setPreference] = useState<AppLanguage | undefined>(
    getLanguagePreference,
  );

  const select = useCallback((language: AppLanguage | undefined) => {
    setPreference(language);
    setLanguagePreference(language);
  }, []);

  return (
    <HeaderScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Spacings.xl },
      ]}
    >
      <LanguageRow
        title={t('screens.language.system')}
        subtitle={t('screens.language.systemSubtitle', {
          language: APP_LANGUAGE_NAMES[getDeviceLanguage()],
        })}
        selected={preference === undefined}
        onPress={() => select(undefined)}
      />
      {APP_LANGUAGES.map(language => (
        <LanguageRow
          key={language}
          title={APP_LANGUAGE_NAMES[language]}
          selected={preference === language}
          onPress={() => select(language)}
        />
      ))}
    </HeaderScrollView>
  );
};
