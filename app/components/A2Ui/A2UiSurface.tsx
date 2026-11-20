// The top-level renderer for one `render_ui` tool call: wraps the surface in
// a card, wires up the shared context (value resolution/editing, action
// dispatch), and renders each top-level component in order. Components nest by
// value, so there is no id registry to resolve — each top-level element draws
// its own subtree.

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { haptics, log, openExternalUrl } from 'helpers';
import { Spacings } from 'style';

import { A2UiAction, A2UiSurface as A2UiSurfaceData } from '../../services/a2ui/types';
import { A2UiContextProvider } from './A2UiContext';
import { ComponentView } from './ComponentView';
import { useSurfaceState } from './state';
import { styles } from './styles';

interface A2UiSurfaceProps {
  surface: A2UiSurfaceData;
}

export const A2UiSurface: React.FC<A2UiSurfaceProps> = ({ surface }) => {
  const { colors } = useStyled();
  const state = useSurfaceState();

  // Debug aid — runs once per mounted surface (re-renders are frequent, so
  // logging every pass would flood the console).
  const mountLogged = React.useRef(false);
  if (!mountLogged.current) {
    mountLogged.current = true;
    log('[a2ui] A2UiSurface mount', JSON.stringify({
      components: surface.components.map(c => c.component),
      dataModel: surface.dataModel ?? {},
    }));
  }

  const context = useMemo(() => {
    const onAction = (action: A2UiAction): void => {
      if ('openUrl' in action) {
        const url = state.resolveValue(action.openUrl.url);
        if (typeof url === 'string') {
          haptics.light();
          openExternalUrl(url);
        }
        return;
      }
      // An `event` has no server to go to in an offline chat; acknowledge it
      // so the interaction still feels alive. A future backend could forward
      // these to the model.
      haptics.medium();
      log('A2UI event dispatched', action.event.name);
    };

    return {
      resolveValue: state.resolveValue,
      setValue: state.setValue,
      onAction,
    };
  }, [state]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <A2UiContextProvider value={context}>
        <View style={{ rowGap: Spacings.sm }}>
          {surface.components.map((component, index) => (
            <ComponentView
              key={index}
              component={component}
              // The data model is the binding scope for everything at the top
              // of the tree; a List narrows it to each item.
              scope={surface.dataModel ?? {}}
            />
          ))}
        </View>
      </A2UiContextProvider>
    </View>
  );
};