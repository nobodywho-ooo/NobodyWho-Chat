// The rendered form of an A2UI card in the message list: a small header (the
// same visual language as ToolCallBlock) above the live A2UiSurface.
//
// Two paths land here:
//  - a settled `render_ui` invocation (persisted, survives reloads), and
//  - the live preview of a `<ui>…</ui>` block mid-stream, which is
//    re-validated on the way through (persisted messages travel the database
//    and back, so validation is re-run rather than trusted).

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { log } from 'helpers';
import { Spacings } from 'style';
import { validateUi } from 'services';
import { ToolInvocation } from 'types';

import { A2UiSurface } from '../../A2Ui/A2UiSurface';
import type { A2UiSurface as A2UiSurfaceData } from '../../../services/a2ui/types';
import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

import { ToolCallBlock } from './ToolCallBlock';

interface A2UiSurfaceCardProps {
  surface: A2UiSurfaceData;
  /** Whether this is a still-streaming preview rather than a settled card. */
  live?: boolean;
  /** A warning/footnote caption shown under the card (e.g. a skip). */
  footnote?: string;
}

/** The header + surface used by both the settled invocation and the live preview. */
export const A2UiSurfaceCard: React.FC<A2UiSurfaceCardProps> = ({
  surface,
  live = false,
  footnote,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const headerLabelStyle = [styles.headerLabel, { color: colors.onSurfaceVariant }];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <PlatformIcon
          iosIconName="square.grid.2x2"
          androidIconName="dashboard"
          size={14}
          color={colors.onSurfaceVariant}
        />
        <Text variant="caption" style={headerLabelStyle}>
          {t('components.messageListItem.a2ui')}
        </Text>
        {live && (
          <Text variant="caption" style={[styles.liveLabel, { color: colors.onSurfaceDisabled }]}>
            {t('components.messageListItem.a2uiRendering')}
          </Text>
        )}
      </View>
      <A2UiSurface surface={surface} />
      {footnote !== undefined && (
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.footnote, { color: colors.warningContent }]}
        >
          {footnote}
        </Text>
      )}
    </View>
  );
};

interface A2UiToolCallProps {
  invocation: ToolInvocation;
}

export const A2UiToolCall: React.FC<A2UiToolCallProps> = ({ invocation }) => {
  const render = useMemo(() => {
    const validation = validateUi(invocation.arguments?.ui);
    if (validation.valid && validation.surface) {
      return { surface: validation.surface, warnings: validation.warnings };
    }
    log('[a2ui] A2UiToolCall unrenderable', validation.warnings);
    return null;
  }, [invocation]);

  if (render === null) {
    return (
      <ToolCallBlock
        name={invocation.name}
        arguments={invocation.arguments}
        onPress={() => undefined}
      />
    );
  }

  return (
    <A2UiSurfaceCard
      surface={render.surface}
      footnote={render.warnings[0]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    rowGap: Spacings.xs,
    marginBottom: Spacings.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
  },
  headerLabel: {
    includeFontPadding: false,
  },
  liveLabel: {
    includeFontPadding: false,
  },
  footnote: {
    includeFontPadding: false,
  },
});
