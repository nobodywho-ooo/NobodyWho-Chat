// The rendered form of a `render_ui` tool call: a small header (the same
// visual language as ToolCallBlock) above the live A2UiSurface. Validation is
// re-run here because persisted messages travel through the database and back;
// an invalid payload falls back to the ordinary tool-call summary instead.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { log } from 'helpers';
import { Spacings } from 'style';
import { validateUi } from 'services';
import { ToolInvocation } from 'types';

import { A2UiSurface } from '../../A2Ui/A2UiSurface';
import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

import { ToolCallBlock } from './ToolCallBlock';

interface A2UiToolCallProps {
  invocation: ToolInvocation;
}

export const A2UiToolCall: React.FC<A2UiToolCallProps> = ({ invocation }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const render = useMemo(() => {
    const raw = invocation.arguments?.ui;
    const validation = validateUi(raw);
    try {
      log('[a2ui] A2UiToolCall validate', JSON.stringify({
        raw,
        valid: validation.valid,
        warnings: validation.warnings,
        components: 'surface' in validation
          ? validation.surface.components.map(c => c.component)
          : undefined,
      }));
    } catch {
      log('[a2ui] A2UiToolCall validate failed to stringify', raw);
    }
    return validation.valid && validation.surface
      ? { surface: validation.surface, warnings: validation.warnings }
      : null;
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
      </View>
      <A2UiSurface surface={render.surface} />
      {render.warnings.length > 0 && (
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.warningLabel, { color: colors.warningContent }]}
        >
          {render.warnings[0]}
        </Text>
      )}
    </View>
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
  warningLabel: {
    includeFontPadding: false,
  },
});
