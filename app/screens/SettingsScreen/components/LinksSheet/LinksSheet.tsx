import React from 'react';
import { Pressable, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { PlatformIcon, Sheet, SheetHeader, Text } from 'components';
import { openExternalUrl } from 'helpers';
import { useStyled } from 'hooks';
import {
  github as GitHubLogo,
  logo as AppLogo,
  nobodywhoWordmark as NobodyWhoWordmark,
  x as XLogo,
} from 'svg';

import styles, { LOGO_SLOT_WIDTH } from './LinksSheet.styles';

const LOGO_SIZE = 22;
const OPEN_ICON_SIZE = 12;

interface Link {
  key: string;
  labelKey: string;
  url: string;
  Logo: React.FC<SvgProps>;
  wide?: boolean;
}

const LINKS: readonly Link[] = [
  {
    key: 'website',
    labelKey: 'screens.settings.website',
    url: 'https://www.nobodywho.ai/',
    Logo: NobodyWhoWordmark,
    wide: true,
  },
  {
    key: 'nobodywho-github',
    labelKey: 'screens.settings.nobodywhoGithub',
    url: 'https://github.com/nobodywho-ooo/nobodywho',
    Logo: GitHubLogo,
  },
  {
    key: 'app-repository',
    labelKey: 'screens.settings.appRepository',
    url: 'https://github.com/nobodywho-ooo/NobodyWho-Chat',
    Logo: AppLogo,
  },
  {
    key: 'x',
    labelKey: 'screens.settings.x',
    url: 'https://x.com/nobodywho_ai',
    Logo: XLogo,
  },
];

const displayUrl = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

interface LinksSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const LinksSheet: React.FC<LinksSheetProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closeLabel={t('navigation.close')}
      showCloseButton={false}
      testID="links-sheet"
    >
      <View style={styles.container}>
        <SheetHeader
          title={t('screens.settings.links')}
          onClose={onClose}
          closeLabel={t('navigation.close')}
          closeTestID="links-sheet-close"
        />
        {LINKS.map(({ key, labelKey, url, Logo, wide }) => (
          <Pressable
            key={key}
            onPress={() => openExternalUrl(url)}
            accessibilityRole="link"
            accessibilityLabel={t(labelKey)}
            accessibilityHint={displayUrl(url)}
            testID={`link-${key}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.logoSlot}>
              <Logo
                width={wide ? LOGO_SLOT_WIDTH : LOGO_SIZE}
                height={LOGO_SIZE}
                color={colors.onSurface}
              />
            </View>
            <View style={styles.textContainer}>
              <Text>{t(labelKey)}</Text>
              <Text
                variant="body2"
                numberOfLines={1}
                style={{ color: colors.onSurfaceVariant }}
              >
                {displayUrl(url)}
              </Text>
            </View>
            <PlatformIcon
              iosIconName="arrow.up.right"
              androidIconName="arrow_outward"
              size={OPEN_ICON_SIZE}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
};
