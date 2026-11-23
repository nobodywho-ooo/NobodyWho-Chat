// The rendered form of an A2UI card in the message list: a small header (the
// same visual language as ToolCallBlock) above the live A2UiSurface.
//
// Two paths land here:
//  - a settled `render_ui` invocation (persisted, survives reloads), whose
//    `arguments.lang` holds the OpenUI Lang source and is re-parsed on the
//    way through (persisted messages travel the database and back, so
//    validation is re-run rather than trusted), and
//  - the live preview of a `<ui>…</ui>` block mid-stream, carrying the
//    already-parsed streaming result.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { log } from 'helpers';
import { Spacings } from 'style';
import { ToolInvocation } from 'types';

import { parseUiSource } from '../../../services/a2ui/parse';
import type { A2UiParseError } from '../../../services/a2ui/types';
import { A2UiSurface } from '../../A2Ui/A2UiSurface';
import type { A2UiLive } from '../../../services/a2ui/types';
import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

import { ToolCallBlock } from './ToolCallBlock';

interface A2UiSurfaceCardProps {
  /** The parsed root element for the card. */
  root: Parameters<typeof A2UiSurface>[0]['root'];
  /** Optional data model exposed to the surface as `$` bindings. */
  dataModel?: Record<string, unknown>;
  /** Whether this is a still-streaming preview rather than a settled card. */
  live?: boolean;
  /** A warning/footnote caption shown under the card (e.g. a skip). */
  footnote?: string;
}

/** The header + surface used by both the settled invocation and the live preview. */
export const A2UiSurfaceCard: React.FC<A2UiSurfaceCardProps> = ({
  root,
  dataModel,
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
      <A2UiSurface root={root} dataModel={dataModel} />
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
  const { t } = useTranslation();
  const parsed = useMemo(() => {
    const lang = (invocation.arguments as { lang?: unknown } | undefined)?.lang;
    if (typeof lang !== 'string' || lang.trim() === '') {
      log('[a2ui] A2UiToolCall without lang source');
      return null;
    }
    return parseUiSource(lang);
  }, [invocation]);

  if (parsed === null) {
    return (
      <ToolCallBlock
        name={invocation.name}
        arguments={invocation.arguments}
        onPress={() => undefined}
      />
    );
  }

  if (parsed.root === null) {
    return (
      <View>
        <Text variant="caption" style={styles.failedText}>
          {t('components.messageListItem.a2uiFailed', { error: metaErrorText(parsed.meta) ?? '' })}
        </Text>
      </View>
    );
  }

  return (
    // Prop-level parser warnings (a dropped variant, a bad marker) are model
    // noise on every tiny-model card — the footnote is reserved for
    // render-blocking problems, which is the root===null branch above.
    <A2UiSurfaceCard root={parsed.root} dataModel={parseDataModel(invocation)} />
  );
};

const metaErrorText = (
  meta: { errors?: A2UiParseError[] | string[] },
): string | undefined => {
  const first = meta.errors?.[0];
  if (!first) {
    return undefined;
  }
  return typeof first === 'string'
    ? first
    : [first.code, first.message].filter(Boolean).join(' — ');
};

const parseDataModel = (
  invocation: ToolInvocation,
): Record<string, unknown> | undefined => {
  const args = invocation.arguments as { dataModel?: unknown } | undefined;
  if (
    args?.dataModel !== null &&
    typeof args?.dataModel === 'object' &&
    !Array.isArray(args?.dataModel)
  ) {
    return args.dataModel as Record<string, unknown>;
  }
  return undefined;
};

/** Live preview card for an in-flight message. */
export const A2UiLiveCard: React.FC<{ live: A2UiLive }> = ({ live }) => (
  <A2UiSurfaceCard root={live.render.root} live />
);

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
  failedText: {
    marginBottom: Spacings.md,
  },
});