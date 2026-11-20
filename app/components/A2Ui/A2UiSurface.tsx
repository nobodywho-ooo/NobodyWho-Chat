// The top-level renderer for one `render_ui` tool call: wraps the surface in
// a card, wires up the shared context (component table, value resolution,
// action dispatch), and renders every root component (a component is a root
// when no other component references it as a child — so an action bar, a form
// and a card can all sit side by side at the top level).

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { haptics, log, openExternalUrl } from 'helpers';
import { Spacings } from 'style';

import { A2UiAction, A2UiComponent, A2UiSurface as A2UiSurfaceData } from '../../services/a2ui/types';
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

  const byId = useMemo(() => {
    const map = new Map<string, A2UiComponent>();
    surface.components.forEach(component => map.set(component.id, component));
    return map;
  }, [surface.components]);

  // Roots are the components nothing else points at.
  const roots = useMemo(() => {
    const referenced = new Set<string>();
    surface.components.forEach(component => {
      switch (component.component) {
        case 'Card':
        case 'Button':
          referenced.add(component.child);
          break;
        case 'Row':
        case 'Column':
          component.children.forEach(id => referenced.add(id));
          break;
        case 'List':
          referenced.add(component.children.componentId);
          break;
      }
    });
    return surface.components.filter(component => !referenced.has(component.id));
  }, [surface.components]);

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
      byId,
      resolveValue: state.resolveValue,
      setValue: state.setValue,
      onAction,
    };
  }, [byId, state]);

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
          {roots.map(component => (
            <ComponentView
              key={component.id}
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

