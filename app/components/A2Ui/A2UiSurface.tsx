// The top-level renderer for one A2UI surface: wires up the shared context
// (reactive evaluation/editing, action dispatch) and renders the parsed
// OpenUI Lang root element. Components nest by value, so there is no id
// registry to resolve — the root element draws its own subtree.

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { haptics, log, openExternalUrl } from 'helpers';
import { Spacings } from 'style';

import { emitA2UiEvent } from '../../services/a2ui/eventsClient';
import type { ElementNode } from '../../services/a2ui/types';
import { A2UiContextProvider } from './A2UiContext';
import { ElementView } from './ComponentView';
import { useSurfaceState } from './state';
import { styles } from './styles';

interface ExprAction {
  k?: string;
  name?: string;
  args?: unknown[];
  mappedProps?: Record<string, unknown>;
  steps?: ExprAction[];
}

interface A2UiSurfaceProps {
  /** The parsed OpenUI Lang root element (null renders nothing). */
  root: ElementNode | null;
  /** Optional root data object exposed to the surface as `$` bindings. */
  dataModel?: Record<string, unknown>;
}

export const A2UiSurface: React.FC<A2UiSurfaceProps> = ({ root, dataModel }) => {
  const { colors } = useStyled();
  const state = useSurfaceState(dataModel);

  // Debug aid — runs once per mounted surface.
  const mountLogged = React.useRef(false);
  if (!mountLogged.current) {
    mountLogged.current = true;
    log('[a2ui] A2UiSurface mount', root?.typeName ?? 'no-root');
  }

  const context = useMemo(() => {
    const evalArg = (arg: unknown): unknown => state.evalValue(arg);

    const dispatchStep = (step: ExprAction | undefined): void => {
      if (!step || step.k === undefined) {
        return;
      }
      if (step.k === 'Action') {
        for (const inner of step.steps ?? []) {
          dispatchStep(inner);
        }
        return;
      }
      switch (step.name) {
        case 'ToAssistant': {
          const raw = evalArg((step.args ?? [])[0]);
          if (typeof raw === 'string' && raw !== '') {
            haptics.medium();
            emitA2UiEvent(raw, undefined);
          }
          return;
        }
        case 'OpenUrl': {
          const url = evalArg((step.args ?? [])[0]);
          if (typeof url === 'string') {
            haptics.light();
            openExternalUrl(url);
          }
          return;
        }
        case 'Set': {
          const target = step.mappedProps?.var;
          const value = evalArg(step.mappedProps?.value ?? (step.args ?? [])[1]);
          if (typeof target === 'string' && target.startsWith('$')) {
            state.setField(target, value);
          }
          return;
        }
        case 'Reset': {
          return;
        }
        default: {
          // A custom action: surface it to the chat like any other event.
          haptics.medium();
          emitA2UiEvent(step.name ?? 'action', undefined);
        }
      }
    };

    const onAction = (action: unknown): void => {
      const node = action as ExprAction | undefined;
      if (node === undefined) {
        return;
      }
      // A single step or an Action([...]) wrapper with steps.
      if (node.steps !== undefined && Array.isArray(node.steps)) {
        for (const inner of node.steps) {
          dispatchStep(inner);
        }
        return;
      }
      dispatchStep(node);
    };

    return {
      evalValue: state.evalValue,
      getState: state.getState,
      setField: state.setField,
      onAction,
    };
  }, [state]);

  if (root === null) {
    return null;
  }

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
          <ElementView node={root} depth={0} />
        </View>
      </A2UiContextProvider>
    </View>
  );
};