import { A2UI_UI_SCHEMA } from '../schema';

// The schema has two hard constraints in this stack:
//  - `Tool` runs JSON.stringify on it (a cycle throws), and
//  - the model's chat template injects it into the prompt (size must be tiny).
// This test pins both, so a future edit can't silently reintroduce either
// failure.
describe('A2UI_UI_SCHEMA', () => {
  test('is acyclic and serializable', () => {
    const json = JSON.stringify(A2UI_UI_SCHEMA);
    expect(typeof json).toBe('string');
    expect(json.length).toBeGreaterThan(100);
  });

  test('is small enough to live in the model prompt', () => {
    const json = JSON.stringify(A2UI_UI_SCHEMA);
    expect(json.length).toBeLessThan(50_000);
  });

  test('constrains the top level precisely and children loosely', () => {
    const schema = JSON.parse(JSON.stringify(A2UI_UI_SCHEMA));
    const items = schema.properties.components.items.oneOf;
    const componentNames = items.map(
      (item: { properties: { component: { enum: string[] } } }) =>
        item.properties.component.enum[0],
    );
    expect(componentNames).toEqual(
      expect.arrayContaining([
        'Text',
        'Row',
        'Column',
        'Card',
        'Button',
        'TextField',
      ]),
    );
    // A container's children must be objects carrying a valid component name
    // (never bare strings / unknown types) — but no recursive expansion.
    const row = items.find(
      (item: { properties: { component: { enum: string[] } } }) =>
        item.properties.component.enum[0] === 'Row',
    );
    const childSchema = row.properties.children.items;
    expect(childSchema.required).toContain('component');
    expect(childSchema.properties.component.enum).toContain('TextField');
  });
});
