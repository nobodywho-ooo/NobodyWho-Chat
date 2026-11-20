// Render context shared by every component of one A2UI surface: value
// resolution/editing and action dispatch. Created once per surface by
// `<A2UiSurface>`. (Components nest by value, so there is no id table.)

import { createContext, useContext } from 'react';
import { A2UiAction } from '../../services/a2ui/types';

export interface A2UiContextValue {
  /**
   * Resolve a wire value against the surface data model (or a list item
   * scope). A manual edit made on this surface shadows the base value.
   */
  resolveValue: (value: unknown, scope?: unknown) => unknown;
  /** Write an edited value back to a data-model path (TextField, Slider…). */
  setValue: (path: string, value: unknown) => void;
  /** A button was pressed — its action may open a URL or dispatch an event. */
  onAction: (action: A2UiAction) => void;
  /** Colour override applied to descendants of a primary button. */
  textColor?: string;
}

export const A2UiContext = createContext<A2UiContextValue | null>(null);

export const useA2UiContext = (): A2UiContextValue => {
  const context = useContext(A2UiContext);
  if (context === null) {
    throw new Error('A2UI component rendered outside an A2UiSurface');
  }
  return context;
};

export const A2UiContextProvider = A2UiContext.Provider;
