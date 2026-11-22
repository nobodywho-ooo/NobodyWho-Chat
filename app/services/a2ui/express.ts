// A2UI "Express" inference format: a compact, positional/keyword constructor
// DSL the model writes inside `<ui>…</ui>`, compiled to the same A2UiSurface
// the renderer consumes. Express is ~3× fewer tokens than wire JSON, so small
// models produce it faster and it eats less context.
//
//   <ui>
//   $/user/name = "Ada"
//   $/level = 3
//   root = Column([
//     Text($/user/name),
//     Slider(min=0, max=10, value=$/level),
//     Button(Text("Save"), variant="primary", action=Event("save", {level: $/level})),
//   ])
//   </ui>
//
// Values: "string", 12, 3.5, true, false, $/path, [ ... ], { key: value },
// Component(args), Event("name", {ctx}), OpenUrl("https://…").
//
// The parser is tolerant and starts from the beginning, stopping at the first
// unclosed construct — so while the model streams it returns the completed
// prefix and the live card fills in without waiting for the block to end.
// Every produced surface is normalized through validateUi before rendering.

import {
  A2UiAction,
  A2UiCheckRule,
  A2UiChoiceOption,
  A2UiComponent,
  A2UiSurface,
  isA2UiComponentName,
} from './types';
import { validateUi } from './validate';

type Node =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'binding'; path: string }
  | { kind: 'list'; items: Node[] }
  | { kind: 'object'; fields: [string, Node][] }
  | { kind: 'call'; name: string; positionals: Node[]; keywords: [string, Node][] };

interface Parser {
  text: string;
  pos: number;
}

const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\r' || c === '\n';

const skipWs = (p: Parser): void => {
  while (p.pos < p.text.length && isWs(p.text[p.pos])) p.pos += 1;
};

const peek = (p: Parser): string | null =>
  p.pos < p.text.length ? p.text[p.pos] : null;

// --- Tolerant parse from the start --------------------------------------

const parseNode = (p: Parser): Node | null => {
  skipWs(p);
  const c = peek(p);
  if (c === null) return null;
  if (c === '"' || c === "'") return parseString(p);
  if (c === '[') return parseArray(p);
  if (c === '{') return parseObject(p);
  if (c === '$' && p.text[p.pos + 1] === '/') return parseBinding(p);
  if (c === 't' || c === 'f' || c === 'n') {
    if (p.text.startsWith('true', p.pos)) { p.pos += 4; return { kind: 'boolean', value: true }; }
    if (p.text.startsWith('false', p.pos)) { p.pos += 5; return { kind: 'boolean', value: false }; }
    if (p.text.startsWith('null', p.pos)) { p.pos += 4; return { kind: 'null' }; }
    return null;
  }
  if (c === '-' || /[0-9]/.test(c)) return parseNumber(p);
  if (/[A-Za-z@_]/.test(c)) return parseCall(p);
  return null;
};

const parseString = (p: Parser): { kind: 'string'; value: string } => {
  const quote = p.text[p.pos];
  p.pos += 1;
  let out = '';
  while (p.pos < p.text.length) {
    const ch = p.text[p.pos];
    if (ch === quote) {
      p.pos += 1;
      return { kind: 'string', value: out };
    }
    if (ch === '\\' && p.pos + 1 < p.text.length) {
      const next = p.text[p.pos + 1];
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      p.pos += 2;
      continue;
    }
    out += ch;
    p.pos += 1;
  }
  return { kind: 'string', value: out }; // unclosed string: take what we have
};

const parseNumber = (p: Parser): { kind: 'number'; value: number } | null => {
  const start = p.pos;
  if (peek(p) === '-') p.pos += 1;
  while (p.pos < p.text.length && /[0-9]/.test(p.text[p.pos])) p.pos += 1;
  if (p.text[p.pos] === '.' && /[0-9]/.test(p.text[p.pos + 1] ?? '')) {
    p.pos += 1;
    while (p.pos < p.text.length && /[0-9]/.test(p.text[p.pos])) p.pos += 1;
  }
  const n = Number(p.text.slice(start, p.pos));
  return Number.isNaN(n) ? null : { kind: 'number', value: n };
};

const parseBinding = (p: Parser): { kind: 'binding'; path: string } | null => {
  p.pos += 1; // $
  if (peek(p) !== '/') return null;
  const start = p.pos;
  while (p.pos < p.text.length && !/[ \t\r\n,)\]}]/.test(p.text[p.pos])) p.pos += 1;
  const path = p.text.slice(start, p.pos);
  return path.length > 0 ? { kind: 'binding', path } : null;
};

const parseArray = (p: Parser): { kind: 'list'; items: Node[] } => {
  p.pos += 1; // [
  const items: Node[] = [];
  skipWs(p);
  while (peek(p) !== null && peek(p) !== ']') {
    const item = parseNode(p);
    if (item === null) break;
    items.push(item);
    skipWs(p);
    if (peek(p) === ',') {
      p.pos += 1;
      skipWs(p);
    } else {
      break;
    }
  }
  skipWs(p);
  if (peek(p) === ']') p.pos += 1; // unclosed list still returns its items
  return { kind: 'list', items };
};

const parseObject = (p: Parser): { kind: 'object'; fields: [string, Node][] } => {
  p.pos += 1; // {
  const fields: [string, Node][] = [];
  skipWs(p);
  while (peek(p) !== null && peek(p) !== '}') {
    const key = parseKey(p);
    if (key === null) break;
    skipWs(p);
    if (peek(p) === ':') p.pos += 1;
    skipWs(p);
    const value = parseNode(p);
    if (value === null) break;
    fields.push([key, value]);
    skipWs(p);
    if (peek(p) === ',') {
      p.pos += 1;
      skipWs(p);
    } else {
      break;
    }
  }
  skipWs(p);
  if (peek(p) === '}') p.pos += 1; // unclosed object still returns its fields
  return { kind: 'object', fields };
};

const parseKey = (p: Parser): string | null => {
  skipWs(p);
  const c = peek(p);
  if (c === '"' || c === "'") return parseString(p).value;
  const start = p.pos;
  while (p.pos < p.text.length && /[A-Za-z0-9_@-]/.test(p.text[p.pos])) p.pos += 1;
  return p.pos > start ? p.text.slice(start, p.pos) : null;
};

const isIdent = (c: string): boolean => /[A-Za-z0-9_@-]/.test(c);

const parseCall = (p: Parser): Node => {
  const name = parseKey(p) ?? '';
  skipWs(p);
  if (peek(p) !== '(') {
    // A bare identifier (e.g. a keyword name) — nothing to hang on.
    return { kind: 'null' };
  }
  p.pos += 1; // (
  const positionals: Node[] = [];
  const keywords: [string, Node][] = [];
  skipWs(p);
  while (peek(p) !== null && peek(p) !== ')') {
    // `key = value` keyword arg? (parseKey would consume the key; so probe)
    const probe = p.pos;
    let keyName: string | null = null;
    if (isIdent(p.text[p.pos] ?? '')) {
      keyName = parseKey(p);
      skipWs(p);
      if (peek(p) !== '=') keyName = null;
    }
    if (keyName !== null) {
      p.pos += 1; // =
      skipWs(p);
      const value = parseNode(p);
      if (value === null) break;
      keywords.push([keyName, value]);
    } else {
      p.pos = probe;
      const value = parseNode(p);
      if (value === null) break;
      positionals.push(value);
    }
    skipWs(p);
    if (peek(p) === ',') {
      p.pos += 1;
      skipWs(p);
    } else {
      break;
    }
  }
  skipWs(p);
  if (peek(p) === ')') p.pos += 1; // unclosed call still returns its args
  return { kind: 'call', name, positionals, keywords };
};

// --- Data lines ----------------------------------------------------------

const parseDataLine = (p: Parser): { path: string; value: Node } | null => {
  skipWs(p);
  if (peek(p) !== '$') return null;
  const start = p.pos;
  const binding = parseBinding(p);
  if (binding === null) return null;
  skipWs(p);
  if (peek(p) !== '=') {
    p.pos = start;
    return null;
  }
  p.pos += 1;
  skipWs(p);
  const value = parseNode(p);
  if (value === null) return null;
  return { path: binding.path, value };
};

const setPath = (
  dataModel: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  let cursor = dataModel;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const child =
      cursor[segment] && typeof cursor[segment] === 'object' && !Array.isArray(cursor[segment])
        ? (cursor[segment] as Record<string, unknown>)
        : {};
    cursor[segment] = child;
    cursor = child;
  }
  const last = segments[segments.length - 1];
  if (last) cursor[last] = value;
};

// --- Full parse ----------------------------------------------------------

export const parseExpress = (
  text: string,
): { surface?: A2UiSurface; error?: string } => {
  const p: Parser = { text, pos: 0 };
  const dataModel: Record<string, unknown> = {};

  const data: { path: string; value: Node }[] = [];
  let root: Node | null = null;

  // Leading `$/path = value` assignment lines, then a single root expression.
  for (;;) {
    const dataLine = parseDataLine(p);
    if (dataLine !== null) {
      data.push(dataLine);
      continue;
    }
    skipWs(p);
    if (p.pos >= p.text.length) break;

    // Optional `name = ` prefix naming the root (skip it).
    const probe = p.pos;
    let hasPrefix = false;
    if (isIdent(p.text[p.pos] ?? '')) {
      parseKey(p);
      skipWs(p);
      if (peek(p) === '=') {
        p.pos += 1;
        skipWs(p);
        hasPrefix = true;
      } else {
        p.pos = probe;
      }
    }
    root = parseNode(p);
    if (root === null && hasPrefix) {
      // The prefixed expr was unparseable — try the whole rest as one node.
      p.pos = probe;
      root = parseNode(p);
    }
    break;
  }

  data.forEach(({ path, value }) => setPath(dataModel, path, convertValue(value)));

  if (root === null) {
    return { error: 'Empty or unparseable <ui> block.' };
  }
  const rootComponent = convertNode(root);
  if (rootComponent === null || !('component' in rootComponent)) {
    return { error: 'The <ui> block did not contain a component expression.' };
  }
  return { surface: { components: [rootComponent], dataModel } };
};

// --- AST -> A2UiSurface --------------------------------------------------

const convertValue = (node: Node | null): unknown => {
  if (node === null) return null;
  switch (node.kind) {
    case 'string': return node.value;
    case 'number': return node.value;
    case 'boolean': return node.value;
    case 'null': return null;
    case 'binding': return { '@path': node.path };
    case 'list': return node.items.map(convertValue);
    case 'object': {
      const out: Record<string, unknown> = {};
      node.fields.forEach(([k, v]) => (out[k] = convertValue(v)));
      return out;
    }
    case 'call': return convertNode(node);
  }
};

const convertNode = (node: Node | null): A2UiComponent | A2UiAction | null => {
  if (node === null || node.kind !== 'call') return null;
  const { name } = node;
  const pos = (i: number): Node | null => node.positionals[i] ?? null;
  const kw = (key: string): Node | null => node.keywords.find(([k]) => k === key)?.[1] ?? null;
  const dyn = (v: Node | null): unknown => convertValue(v);
  const stringOrBinding = (v: Node | null): string | { '@path': string } =>
    (dyn(v) ?? '') as string | { '@path': string };
  const childOf = (v: Node | null): A2UiComponent | null => {
    const c = convertNode(v);
    return c && 'component' in c ? (c as A2UiComponent) : null;
  };

  const enumVal = (
    v: Node | null,
    fallback: Node | null,
    allowed: readonly string[],
  ): string | undefined => {
    const nd = v ?? fallback;
    if (nd && nd.kind === 'string' && (allowed as string[]).includes(nd.value)) {
      return nd.value;
    }
    return undefined;
  };
  const enumObj = (
    key: string,
    nd: Node | null,
    fallback: Node | null,
    allowed: readonly string[],
  ): Record<string, string> => {
    const value = enumVal(nd, fallback, allowed);
    return value ? { [key]: value } : {};
  };
  const numberVal = (v: Node | null, fallback: number): number =>
    v && v.kind === 'number' ? v.value : fallback;

  switch (name) {
    case 'Text':
      return {
        component: 'Text',
        text: stringOrBinding(kw('text') ?? pos(0)),
        ...enumObj('variant', kw('variant'), pos(1), ['caption', 'body']),
        ...(kw('weight')?.kind === 'number' ? { weight: (kw('weight') as any).value } : {}),
      };
    case 'Icon':
      return {
        component: 'Icon',
        name: stringOrBinding(kw('name') ?? pos(0)) as string,
        ...enumObj('variant', kw('variant'), pos(1), ['small', 'medium', 'large']),
      };
    case 'Image':
      return {
        component: 'Image',
        url: stringOrBinding(kw('url') ?? pos(0)),
        ...(kw('description') ? { description: convertValue(kw('description')) as any } : {}),
      };
    case 'Row':
    case 'Column': {
      const children: A2UiComponent[] = [];
      const list = kw('children') ?? pos(0);
      if (list && list.kind === 'list') {
        list.items.forEach(item => {
          const c = childOf(item);
          if (c) children.push(c);
        });
      }
      const justifyAllowed =
        name === 'Row'
          ? ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch']
          : ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'];
      return {
        component: name,
        children,
        ...enumObj('justify', kw('justify'), pos(1), justifyAllowed),
        ...enumObj('align', kw('align'), pos(2), ['start', 'center', 'end', 'stretch']),
      };
    }
    case 'Card': {
      const c = childOf(kw('child') ?? pos(0));
      return c ? { component: 'Card', child: c } : null;
    }
    case 'Divider':
      return {
        component: 'Divider',
        ...enumObj('axis', kw('axis'), pos(0), ['horizontal', 'vertical']),
      };
    case 'Button': {
      const c = childOf(kw('child') ?? pos(0));
      if (!c) return null;
      const action = parseAction(kw('action'));
      if (!action) return null;
      return {
        component: 'Button',
        child: c,
        action,
        ...enumObj('variant', kw('variant'), pos(1), ['default', 'primary', 'borderless']),
      };
    }
    case 'Event': {
      const nameNode = pos(0);
      const context = (kw('context') ?? pos(1)) ?? null;
      const ctx: Record<string, unknown> = {};
      if (context && context.kind === 'object') {
        context.fields.forEach(([k, v]) => (ctx[k] = convertValue(v)));
      }
      return {
        event: {
          name: nameNode && nameNode.kind === 'string' ? nameNode.value : '',
          ...(Object.keys(ctx).length ? { context: ctx } : {}),
        },
      };
    }
    case 'OpenUrl': {
      const url = pos(0);
      const resolved = url && url.kind === 'string' ? url.value : '';
      return { openUrl: { url: resolved } };
    }
    case 'List': {
      const path = kw('path') ?? pos(0);
      const template = childOf(kw('component') ?? pos(1));
      if (!template || !path || path.kind !== 'string') return null;
      return {
        component: 'List',
        children: { path: path.value, component: template },
        ...enumObj('direction', kw('direction'), null, ['vertical', 'horizontal']),
      };
    }
    case 'TextField': {
      const checks = parseChecks(kw('checks'));
      return {
        component: 'TextField',
        label: stringOrBinding(kw('label') ?? pos(0)),
        value: stringOrBinding(kw('value') ?? pos(1)),
        ...(kw('placeholder')
          ? { placeholder: convertValue(kw('placeholder')) as any }
          : {}),
        ...enumObj('variant', kw('variant'), pos(2), ['shortText', 'longText', 'number', 'obscured']),
        ...(checks.length ? { '@checks': checks } : {}),
        ...(kw('weight')?.kind === 'number' ? { weight: (kw('weight') as any).value } : {}),
      };
    }
    case 'CheckBox':
      return {
        component: 'CheckBox',
        label: stringOrBinding(kw('label') ?? pos(0)),
        value: (dyn(kw('value') ?? pos(1)) ?? false) as boolean | { '@path': string },
      };
    case 'Slider':
      return {
        component: 'Slider',
        min: numberVal(kw('min') ?? pos(0), 0),
        max: numberVal(kw('max') ?? pos(1), 100),
        value: (dyn(kw('value') ?? pos(2)) ?? 0) as number | { '@path': string },
        ...(kw('steps')?.kind === 'number' ? { steps: (kw('steps') as any).value } : {}),
        ...(kw('label') ? { label: convertValue(kw('label')) as any } : {}),
      };
    case 'ChoicePicker': {
      const options: A2UiChoiceOption[] = listArg(kw('options') ?? pos(0)).flatMap(item => {
        if (item.kind !== 'object') return [];
        const f = new Map(item.fields);
        const label = f.get('label');
        const value = f.get('value');
        return [
          {
            label: convertValue(label ?? null) as any,
            value: value && value.kind === 'string' ? value.value : String(convertValue(value ?? null)),
          },
        ];
      });
      const valueNode = kw('value') ?? pos(1);
      const value =
        valueNode && valueNode.kind === 'list'
          ? listOfStrings(valueNode)
          : (convertValue(valueNode) ?? []);
      return {
        component: 'ChoicePicker',
        options,
        value: value as string[] | { '@path': string },
        ...(kw('label') ? { label: convertValue(kw('label')) as any } : {}),
        ...enumObj('variant', kw('variant'), null, ['multipleSelection', 'mutuallyExclusive']),
        ...enumObj('displayStyle', kw('displayStyle'), null, ['checkbox', 'chips']),
      };
    }
    case 'Tabs': {
      const tabs = listArg(kw('tabs') ?? pos(0)).flatMap(item => {
        if (item.kind !== 'object') return [];
        const f = new Map(item.fields);
        const child = childOf(f.get('child') ?? null);
        if (!child) return [];
        return [{ title: convertValue(f.get('title') ?? null) as any, child }];
      });
      return tabs.length > 0 ? { component: 'Tabs', tabs } : null;
    }
    default:
      return null;
  }
};

const parseAction = (node: Node | null): A2UiAction | null => {
  if (!node || node.kind !== 'call') return null;
  const action = convertNode(node);
  return action && 'event' in action ? (action as A2UiAction) : null;
};

const parseChecks = (node: Node | null): A2UiCheckRule[] => {
  if (!node || node.kind !== 'list') return [];
  return listArg(node).flatMap(checkItem => {
    if (checkItem.kind !== 'object') return [];
    const f = new Map(checkItem.fields);
    const condition = f.get('condition');
    const c = condition && condition.kind === 'string' ? condition.value : 'required';
    if (c !== 'required' && c !== 'numeric' && c !== 'email') return [];
    const message = f.get('message');
    return [
      {
        condition: c as A2UiCheckRule['condition'],
        ...(message ? { message: convertValue(message) as any } : {}),
      },
    ];
  });
};

const listArg = (v: Node | null): Node[] => (v && v.kind === 'list' ? v.items : []);

const listOfStrings = (v: { items: Node[] }): string[] =>
  v.items.map(item =>
    item.kind === 'string' ? item.value : String(convertValue(item)),
  );

// Live/normalized entry used by the stream and turn-end paths.
export const parseExpressLive = (raw: string): A2UiSurface | null => {
  const result = parseExpress(raw);
  if (!result.surface) return null;
  const validation = validateUi(result.surface);
  return validation.valid && validation.surface ? validation.surface : null;
};

// Re-exported so the catalog text can enumerate the accepted components; also
// lets callers check a name before constructing.
export { isA2UiComponentName };