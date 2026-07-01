// This test reads app-entry files off disk. The app tsconfig scopes global
// types to `["jest"]` (no @types/node), so `fs`/`path`/`__dirname` are declared
// locally rather than pulling Node types into the whole project.
declare const __dirname: string;
const { readFileSync } = require('fs');
const { join } = require('path');

// Regression guard for the model-download "The file 'Documents' couldn't be
// saved…" crash.
//
// expo-file-system's `Paths.join` builds child paths by assigning to a URL's
// `pathname` and reading it back via `toString()`:
//
//   const u = asUrl(baseFileUri);
//   u.pathname = nodePath.join(u.pathname, childSegment);
//   return u.toString();
//
// React Native's built-in `URL` (Libraries/Blob/URL.js) is a regex stub with a
// `pathname` GETTER but NO setter, and its `toString()` returns the original
// string. So the assignment is a silent no-op and `Paths.join` returns the base
// UNCHANGED — every `new Directory(base, 'models')` / `new File(dir, name)`
// collapses to the bare Documents directory, and the first write onto it fails.
//
// The fix is importing `react-native-url-polyfill/auto` at the top of index.js
// so a spec-compliant WHATWG `URL` is installed before anything touches
// expo-file-system. Jest runs on Node (whose global `URL` already has a working
// setter), so it cannot observe the on-device stub — the real teeth here is the
// structural check that the polyfill is wired into index.js.

const ROOT = join(__dirname, '..', '..', '..');

// Faithful stand-in for RN's built-in URL: pathname getter only, no setter,
// toString returns the source string verbatim.
class ReactNativeStubURL {
  private _url: string;
  constructor(url: string) {
    this._url = url;
  }
  get pathname(): string {
    const m = this._url.match(/https?:\/\/[^/]+(\/[^?#]*)?/);
    return m ? m[1] || '/' : '/';
  }
  // no `set pathname` — assigning silently creates a dead own-property
  set hash(_v: string) {}
  toString(): string {
    return this._url;
  }
}

// The exact operation Paths.join performs to append a child segment.
const joinLikeExpo = (
  URLImpl: { new (u: string): { pathname: string; toString(): string } },
  base: string,
  child: string,
): string => {
  const u = new URLImpl(base);
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/${child}`;
  return u.toString();
};

const DOC = 'file:///var/app/Documents/';

describe('expo-file-system Paths.join requires a spec-compliant global URL', () => {
  it("drops the child segment under RN's stub URL (the download bug)", () => {
    // No pathname setter -> the segment is lost, base returned unchanged.
    expect(joinLikeExpo(ReactNativeStubURL as never, DOC, 'models')).toBe(DOC);
  });

  it('appends the child segment with a spec-compliant URL', () => {
    // The runtime global URL (Node in jest; the WHATWG polyfill on device).
    expect(joinLikeExpo(URL as never, DOC, 'models')).toBe(
      'file:///var/app/Documents/models',
    );
  });
});

describe('the URL polyfill is wired into app startup', () => {
  const indexSrc = readFileSync(join(ROOT, 'index.js'), 'utf8');

  it('index.js imports react-native-url-polyfill/auto', () => {
    expect(indexSrc).toMatch(/react-native-url-polyfill\/auto/);
  });

  it('imports the polyfill before ./App (which pulls in expo-file-system)', () => {
    const polyfillIdx = indexSrc.indexOf('react-native-url-polyfill/auto');
    const appIdx = indexSrc.indexOf('./App');
    expect(polyfillIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeGreaterThan(-1);
    expect(polyfillIdx).toBeLessThan(appIdx);
  });

  it('declares react-native-url-polyfill as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies['react-native-url-polyfill']).toBeDefined();
  });
});
