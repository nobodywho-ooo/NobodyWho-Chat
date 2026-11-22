import {
  A2UI_CLOSE,
  A2UI_OPEN,
  findA2UiBlock,
  parseA2UiLive,
  stripA2UiBlocks,
} from '../stream';
import { A2UI_STREAM_GBNF } from '../grammar';

const block = (ui: string) => `${A2UI_OPEN}${ui}${A2UI_CLOSE}`;

describe('findA2UiBlock', () => {
  test('returns null before the opening sentinel', () => {
    expect(findA2UiBlock('Just some prose.')).toBeNull();
  });

  test('returns an incomplete block while streaming', () => {
    const found = findA2UiBlock(`${A2UI_OPEN}{"components":[{"component":"T`);
    expect(found).not.toBeNull();
    expect(found?.uiText).toBe('{"components":[{"component":"T');
    expect(found?.complete).toBe(false);
  });

  test('returns a complete block once the closing sentinel arrives', () => {
    const text = `Here it is: ${block(JSON.stringify({ components: [] }))}`;
    const found = findA2UiBlock(text);
    expect(found?.complete).toBe(true);
    expect(found?.uiText).toContain('"components"');
  });
});

describe('stripA2UiBlocks', () => {
  test('removes closed blocks and keeps prose', () => {
    const text = `One line. ${block('{"components":[]}')} Another line.`;
    expect(stripA2UiBlocks(text)).toBe('One line.  Another line.');
  });

  test('removes an unterminated trailing block', () => {
    const text = 'One line. ' + `${A2UI_OPEN}{"components":[]`;
    expect(stripA2UiBlocks(text).trim()).toBe('One line.');
  });
});

describe('A2UI_STREAM_GBNF (whole-turn grammar)', () => {
  test('wraps the UI-object grammar inside the <ui> sentinels', () => {
    expect(A2UI_STREAM_GBNF).toContain('<ui>');
    expect(A2UI_STREAM_GBNF).toContain('</ui>');
    // The UI object grammar promotes its root rule to a reusable `ui` rule.
    expect(A2UI_STREAM_GBNF).toMatch(/^ui\s+::=/m);
  });

  test('lets prose be free while a <ui> routes to the constrained block', () => {
    expect(A2UI_STREAM_GBNF).toMatch(/prose ::=/);
    expect(A2UI_STREAM_GBNF).toMatch(/uiblock ::=/);
    expect(A2UI_STREAM_GBNF).toMatch(/segment ::= prose | uiblock/);
  });
});

describe('parseA2UiLive', () => {
  test('parses complete ui JSON', () => {
    const ui = JSON.stringify({
      components: [
        { component: 'Text', text: 'Hello' },
        { component: 'Divider' },
      ],
    });
    const surface = parseA2UiLive(ui);
    expect(surface?.components.map(c => c.component)).toEqual(['Text', 'Divider']);
  });

  test('renders the components streamed so far, skipping the unfinished tail', () => {
    // The stream is partway through a second Text object.
    const partial =
      '{"components":[{"component":"Text","text":"First"},{"component":"Text","text":"Sec';
    const surface = parseA2UiLive(partial);
    expect(surface?.components).toHaveLength(1);
    if (surface && surface.components[0].component === 'Text') {
      expect(surface.components[0].text).toBe('First');
    }
  });

  test('returns null before anything renderable exists', () => {
    expect(parseA2UiLive('')).toBeNull();
    expect(parseA2UiLive('{"components":[]')).toBeNull();
    expect(parseA2UiLive('garbage')).toBeNull();
  });

  test('validates: unknown components inside the block are dropped, not fatal', () => {
    const surface = parseA2UiLive(
      '{"components":[{"component":"Video","url":"x"},{"component":"Text","text":"ok"}]}',
    );
    expect(surface?.components.map(c => c.component)).toEqual(['Text']);
  });
});
