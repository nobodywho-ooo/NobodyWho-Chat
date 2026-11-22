// Evaluation state for one rendered surface.
//
// OpenUI Lang parses literals straight into props, so at render time most
// values are plain strings/numbers/arrays/objects. Reactive parts — `$name`
// references and the expressions built from them — arrive as small AST nodes
// (`{ k: "StateRef", n: "$name" }`, `{ k: "BinOp", op: "+", left, right }`,
// …) and are evaluated here against the surface's state: a data model plus
// any edits the user has made in fields, checkboxes, sliders and pickers.
// Every edit shadows the base value, so TextContent("Hi " + $name) updates
// live while the user types.

import { useState } from 'react';
import type { A2UiSurfaceData } from '../../services/a2ui/types';

export interface SurfaceState {
  /** Evaluate a prop value (literal or reactive AST node) to a concrete value. */
  evalValue: (value: unknown) => unknown;
  /** The current value of a `$name` state slot. */
  getState: (name: string) => unknown;
  /** Record an edit for a `$name` state slot (shadows the data model). */
  setField: (name: string, value: unknown) => void;
}

// --- Reactive expression AST (nodes @openuidev/lang-core emits) -------------

interface ExprNode {
  k: string;
  v?: unknown;
  n?: string;
  op?: string;
  left?: unknown;
  right?: unknown;
  cond?: unknown;
  then?: unknown;
  else?: unknown;
  els?: unknown[];
  fields?: Record<string, unknown>;
  args?: unknown[];
  mappedProps?: Record<string, unknown>;
  name?: string;
}

const isExprNode = (value: unknown): value is ExprNode =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'k' in value;

const stripDollar = (name: string): string =>
  name.startsWith('$') ? name.slice(1) : name;

export const useSurfaceState = (
  dataModel: A2UiSurfaceData['dataModel'],
): SurfaceState => {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  const getState = (name: string): unknown => {
    const key = stripDollar(name);
    if (key in overrides) {
      return overrides[key];
    }
    return dataModel?.[key];
  };

  const evalValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(item => evalValue(item));
    }
    if (!isExprNode(value)) {
      return value;
    }
    switch (value.k) {
      case 'Str':
      case 'Num':
      case 'Bool':
        return value.v;
      case 'Null':
        return null;
      case 'Arr':
        return (value.els ?? []).map(item => evalValue(item));
      case 'Obj': {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value.fields ?? {})) {
          out[key] = evalValue(item);
        }
        return out;
      }
      case 'StateRef':
        return getState(value.n ?? '');
      case 'Ternary':
        return evalValue(value.cond)
          ? evalValue(value.then)
          : evalValue(value.else);
      case 'BinOp': {
        const op = value.op ?? '';
        const left = evalValue(value.left) as number | string;
        const right = evalValue(value.right) as number | string;
        switch (op) {
          case '+':
            return typeof left === 'string' || typeof right === 'string'
              ? String(left) + String(right)
              : Number(left) + Number(right);
          case '-': return Number(left) - Number(right);
          case '*': return Number(left) * Number(right);
          case '/': return Number(left) / Number(right);
          case '%': return Number(left) % Number(right);
          case '==': return left === right;
          case '!=': return left !== right;
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '&&': return Boolean(left) && Boolean(right);
          case '||': return Boolean(left) || Boolean(right);
          default: return undefined;
        }
      }
      case 'Comp':
        return evalCall(value, evalValue);
      default:
        return undefined;
    }
  };

  const setField = (name: string, value: unknown): void => {
    const key = stripDollar(name);
    setOverrides(previous => ({ ...previous, [key]: value }));
  };

  return { evalValue, getState, setField };
};

// --- `@Name(args)` function calls (the pure built-ins lang-core ships) ------

const arg = (
  node: ExprNode,
  name: string,
  index: number,
  evalValue: (v: unknown) => unknown,
): unknown => {
  const mapped = node.mappedProps?.[name];
  if (mapped !== undefined) {
    return evalValue(mapped);
  }
  return evalValue((node.args ?? [])[index]);
};

const toNumbers = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map(v => Number(v))
        .filter(v => Number.isFinite(v))
    : [];

const evalCall = (
  node: ExprNode,
  evalValue: (value: unknown) => unknown,
): unknown => {
  const name = node.name ?? '';
  switch (name) {
    case 'Count': {
      const value = arg(node, 'array', 0, evalValue);
      return Array.isArray(value) ? value.length : 0;
    }
    case 'First': {
      const value = arg(node, 'array', 0, evalValue);
      return Array.isArray(value) ? (value[0] ?? null) : null;
    }
    case 'Last': {
      const value = arg(node, 'array', 0, evalValue);
      return Array.isArray(value) ? (value[value.length - 1] ?? null) : null;
    }
    case 'Sum': {
      const nums = toNumbers(arg(node, 'numbers', 0, evalValue));
      return nums.reduce((a, b) => a + b, 0);
    }
    case 'Avg': {
      const nums = toNumbers(arg(node, 'numbers', 0, evalValue));
      return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case 'Min': {
      const nums = toNumbers(arg(node, 'numbers', 0, evalValue));
      return nums.length === 0 ? 0 : Math.min(...nums);
    }
    case 'Max': {
      const nums = toNumbers(arg(node, 'numbers', 0, evalValue));
      return nums.length === 0 ? 0 : Math.max(...nums);
    }
    case 'Round': {
      const value = Number(arg(node, 'value', 0, evalValue));
      return Number.isFinite(value) ? Math.round(value) : 0;
    }
    case 'Floor': {
      const value = Number(arg(node, 'value', 0, evalValue));
      return Number.isFinite(value) ? Math.floor(value) : 0;
    }
    case 'Ceil': {
      const value = Number(arg(node, 'value', 0, evalValue));
      return Number.isFinite(value) ? Math.ceil(value) : 0;
    }
    case 'Abs': {
      const value = Number(arg(node, 'value', 0, evalValue));
      return Number.isFinite(value) ? Math.abs(value) : 0;
    }
    default:
      return undefined;
  }
};