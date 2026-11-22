// Render context shared by every component of one A2UI surface: reactive
// value evaluation and action dispatch. Created once per surface by
// `<A2UiSurface>`. (Components nest by value, so there is no id table.)

import { createContext, useContext } from 'react';

export interface A2UiContextValue {
  /**
   * Evaluate a prop value — a literal (string/number/array/object) or a
   * reactive AST node (`$name` references, ternaries, binary expressions,
   * `@` function calls) — to a concrete value.
   */
  evalValue: (value: unknown) => unknown;
  /** The current value of a `$name` state slot (edits shadow the base). */
  getState: (name: string) => unknown;
  /** Record an edit for a `$name` state slot (TextField, CheckBox…). */
  setField: (name: string, value: unknown) => void;
  /** A button was pressed — its action may open a URL or dispatch an event. */
  onAction: (action: unknown) => void;
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