import {
  A2UI_CLOSE,
  A2UI_OPEN,
  findA2UiBlock,
  parseA2UiLive,
  stripA2UiBlocks,
} from '../stream';
import { parseExpress } from '../express';
import { A2UI_STREAM_GBNF } from '../grammar';

const block = (expr: string) => `${A2UI_OPEN}${expr}${A2UI_CLOSE}`;

describe('findA2UiBlock', () => {
  test('returns null before the opening sentinel', () => {
    expect(findA2UiBlock('Just some prose.')).toBeNull();
  });

  test('returns an incomplete block while streaming', () => {
    const found = findA2UiBlock(`${A2UI_OPEN}Column([Text("`);
    expect(found?.complete).toBe(false);
    expect(found?.uiText).toBe('Column([Text("');
  });

  test('returns a complete block once the closing sentinel arrives', () => {
    const found = findA2UiBlock(`Here it is: ${block('Text("hi")')}`);
    expect(found?.complete).toBe(true);
    expect(found?.uiText).toContain('Text(');
  });
});

describe('stripA2UiBlocks', () => {
  test('removes closed blocks and keeps prose', () => {
    expect(stripA2UiBlocks(`One. ${block('Text("x")')} Two.`)).toBe('One.  Two.');
  });

  test('removes an unterminated trailing block', () => {
    expect(stripA2UiBlocks('One. ' + `${A2UI_OPEN}Text("x`).trim()).toBe('One.');
  });
});

describe('A2UI_STREAM_GBNF (whole-turn Express grammar)', () => {
  test('keeps prose free and constrains Express inside <ui>', () => {
    expect(A2UI_STREAM_GBNF).toContain('<ui>');
    expect(A2UI_STREAM_GBNF).toContain('</ui>');
    expect(A2UI_STREAM_GBNF).toMatch(/^prose ::=/m);
    expect(A2UI_STREAM_GBNF).toMatch(/^uiblock ::=/m);
    expect(A2UI_STREAM_GBNF).toMatch(/^call ::=/m);
    expect(A2UI_STREAM_GBNF).toMatch(/^kwarg ::=/m);
    expect(A2UI_STREAM_GBNF).not.toMatch(/<Icon/);
  });

  test('every rule body is single-line (nobodywho converter constraint)', () => {
    const wrapped = A2UI_STREAM_GBNF.split('\n').some(
      line => line.trim().length > 0 && /^\s/.test(line),
    );
    expect(wrapped).toBe(false);
  });
});

describe('parseA2UiLive (Express)', () => {
  test('parses a complete Express block with bindings and data lines', () => {
    const surface = parseA2UiLive('$/user/name = "Ada"\nroot = Column([Text($/user/name)])');
    expect(surface).not.toBeNull();
    expect(surface?.dataModel).toEqual({ user: { name: 'Ada' } });
    const root = surface?.components[0];
    expect(root?.component).toBe('Column');
  });

  test('includes components as they stream in, even mid-string tails', () => {
    // The second Text's string is still being written, but is already visible.
    const surface = parseA2UiLive('Column([Text("First"), Text("Sec');
    const root = surface?.components[0];
    if (root && root.component === 'Column') {
      expect(root.children.map(c => c.component)).toEqual(['Text', 'Text']);
      const first = root.children[0];
      if (first.component === 'Text') {
        expect(first.text).toBe('First');
      }
    }
  });

  test('renders a TextField with checks and a Button action', () => {
    const surface = parseA2UiLive(
      'Column([TextField(label="Email", value="", checks=[{condition:"email", message:"bad"}] ), Button(Text("Go"), variant="primary", action=Event("submit", {}))])',
    );
    const root = surface?.components[0];
    if (root && root.component === 'Column') {
      expect(root.children.map(c => c.component)).toEqual(['TextField', 'Button']);
      const field = root.children[0];
      if (field.component === 'TextField') {
        expect(field['@checks']).toEqual([{ condition: 'email', message: 'bad' }]);
      }
    }
  });

  test('returns null on an empty / unparseable block', () => {
    expect(parseExpress('')).toBeDefined();
    expect(parseExpress('').error).toBeDefined();
    expect(parseA2UiLive('')).toBeNull();
    expect(parseA2UiLive('garbage')).toBeNull();
  });
});