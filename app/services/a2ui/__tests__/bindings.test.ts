import { bindingPath, isBinding, resolvePath, resolveValue } from '../bindings';

const dataModel = {
  user: { name: 'Ada' },
  tags: ['a', 'b'],
  empty: '',
  nope: null,
};

describe('resolvePath', () => {
  test('walks absolute paths', () => {
    expect(resolvePath('/user/name', dataModel)).toBe('Ada');
    expect(resolvePath('/tags/1', dataModel)).toBe('b');
  });

  test('walks relative paths (list item scope)', () => {
    expect(resolvePath('name', { name: 'Lin' })).toBe('Lin');
  });

  test('misses resolve to undefined, never throw', () => {
    expect(resolvePath('/user/missing', dataModel)).toBeUndefined();
    expect(resolvePath('/nope/deep', dataModel)).toBeUndefined();
    expect(resolvePath('/user', 'just-a-string')).toBeUndefined();
    expect(resolvePath('/sibling', null)).toBeUndefined();
  });

  test('a path that lands on null stops there', () => {
    expect(resolvePath('/nope', dataModel)).toBeNull();
    expect(resolvePath('/nope/key', dataModel)).toBeUndefined();
  });
});

describe('resolveValue', () => {
  test('passes literals through untouched', () => {
    expect(resolveValue('plain', dataModel)).toBe('plain');
    expect(resolveValue(42, dataModel)).toBe(42);
    expect(resolveValue(false, dataModel)).toBe(false);
  });

  test('resolves bindings', () => {
    expect(resolveValue({ '@path': '/user/name' }, dataModel)).toBe('Ada');
  });

  test('undefined binding path resolves to undefined', () => {
    expect(resolveValue({ '@path': '/missing' }, dataModel)).toBeUndefined();
  });
});

describe('isBinding / bindingPath', () => {
  test('recognises bindings only', () => {
    expect(isBinding({ '@path': '/a' })).toBe(true);
    expect(isBinding({ '@path': '' })).toBe(false);
    expect(isBinding({ text: 'x' })).toBe(false);
    expect(isBinding(null)).toBe(false);
    expect(isBinding('x')).toBe(false);

    expect(bindingPath({ '@path': '/a' })).toBe('/a');
    expect(bindingPath('x')).toBeNull();
  });
});
