import {
  A2UI_CLOSE,
  A2UI_OPEN,
  findA2UiBlock,
  findImplicitA2UiBlock,
  parseA2UiLive,
  stripA2UiBlocks,
} from '../stream';
import { A2UI_STREAM_GBNF } from '../grammar';

const block = (lang: string) => `${A2UI_OPEN}${lang}${A2UI_CLOSE}`;

const SIMPLE = `root = Stack([TextContent("Hello")])`;

describe('findA2UiBlock', () => {
  test('returns null before the opening sentinel', () => {
    expect(findA2UiBlock('Just some prose.')).toBeNull();
  });

  test('returns an incomplete block while streaming', () => {
    const found = findA2UiBlock(`${A2UI_OPEN}root = Stack([TextContent("`);
    expect(found?.complete).toBe(false);
    expect(found?.uiText).toBe('root = Stack([TextContent("');
  });

  test('returns a complete block once the closing sentinel arrives', () => {
    const found = findA2UiBlock(`Here it is: ${block(SIMPLE)}`);
    expect(found?.complete).toBe(true);
    expect(found?.uiText).toContain('root = Stack(');
  });
});

describe('stripA2UiBlocks', () => {
  test('removes closed blocks and keeps prose', () => {
    expect(stripA2UiBlocks(`One. ${block(SIMPLE)} Two.`)).toBe('One.  Two.');
  });

  test('removes an unterminated trailing block', () => {
    expect(stripA2UiBlocks('One. ' + `${A2UI_OPEN}root = Stack([`).trim()).toBe('One.');
  });
});

describe('parseA2UiLive', () => {
  test('parses a complete program to a root element', () => {
    const { root, meta } = parseA2UiLive(SIMPLE);
    expect(root?.typeName).toBe('Stack');
    expect(meta.incomplete).toBeFalsy();
  });

  test('tolerates an incomplete trailing statement while streaming', () => {
    const { root, meta } = parseA2UiLive(`root = Stack([title])\ntitle = TextContent("H`);
    expect((root?.props.children as unknown[]).length).toBeGreaterThan(0);
    expect(meta.incomplete).toBe(true);
    // The partial title is still renderable.
    const child = (root?.props.children as unknown[])[0] as {
      typeName?: string;
      props?: { text?: unknown };
    };
    expect(child.typeName).toBe('TextContent');
    expect(child.props?.text).toBe('H');
  });

  test('keeps the partial node until it completes', () => {
    const first = parseA2UiLive(`root = Stack([title])\ntitle = TextContent("H`);
    expect(
      ((first.root?.props.children as unknown[])[0] as { partial?: boolean })
        .partial,
    ).toBe(true);
  });
});

describe('findImplicitA2UiBlock', () => {
  test('adopts a whole turn that is one bare program', () => {
    const found = findImplicitA2UiBlock(SIMPLE);
    expect(found?.complete).toBe(true);
    expect(found?.uiText).toBe(SIMPLE);
  });

  test('ignores prose', () => {
    expect(findImplicitA2UiBlock('Here are some museums.')).toBeNull();
  });

  test('ignores text that contains sentinels (handled elsewhere)', () => {
    expect(
      findImplicitA2UiBlock(`Some text ${block(SIMPLE)} more`),
    ).toBeNull();
  });

  test('ignores an incomplete program', () => {
    expect(
      findImplicitA2UiBlock(`root = Stack([TextContent("unclosed`),
    ).toBeNull();
  });
});

describe('A2UI_STREAM_GBNF', () => {
  test('contains the OpenUI Lang statement rules', () => {
    expect(A2UI_STREAM_GBNF).toContain('stmt ::= ident ws "=" ws expr');
    expect(A2UI_STREAM_GBNF).toContain('root ::= segment*');
    expect(A2UI_STREAM_GBNF).toContain('Stack');
    expect(A2UI_STREAM_GBNF).toContain('TextContent');
  });

  test('String.raw keeps backslashes byte-identical', () => {
    // No double-escaped control bytes: the wire text must match a file parse.
    expect(A2UI_STREAM_GBNF).not.toContain('\\x');
    expect(A2UI_STREAM_GBNF).toContain(
      'dchar ::= [^"' + '\\'.repeat(3) + 'n]',
    );
  });
});