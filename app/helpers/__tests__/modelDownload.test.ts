const MB = 1024 * 1024;
// Must match CHUNK_BYTES in modelDownload.ts.
const CHUNK = 16 * MB;
const MODELS = 'file:///docs/models';

// A stateful in-memory expo-file-system mock (overrides the shared jest setup
// mock for this file). File sizes on disk are the source of truth for resume,
// so the mock tracks a path -> byte-size map and lets downloadFileAsync grow it.
jest.mock('expo-file-system', () => {
  const join = (segs: any[]): string =>
    segs
      .map(s => (typeof s === 'string' ? s : s && s.uri ? s.uri : ''))
      .filter(Boolean)
      .reduce((acc, part) =>
        acc ? `${acc.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}` : part,
      );

  const sizes = new Map<string, number>();
  const texts = new Map<string, string>();

  class File {
    uri: string;
    constructor(...segs: any[]) {
      this.uri = join(segs);
    }
    get exists() {
      return sizes.has(this.uri);
    }
    // Matches iOS: reading .size for a MISSING file yields null (not 0), which
    // is exactly what poisoned the Range header (`bytes=null-…` -> HTTP 400).
    get size() {
      return sizes.has(this.uri) ? (sizes.get(this.uri) as number) : null;
    }
    create() {
      if (!sizes.has(this.uri)) sizes.set(this.uri, 0);
    }
    delete() {
      sizes.delete(this.uri);
      texts.delete(this.uri);
    }
    write(content: any, opts?: { append?: boolean }) {
      const len = content.length as number;
      const cur = sizes.get(this.uri) ?? 0;
      sizes.set(this.uri, opts?.append ? cur + len : len);
      if (typeof content === 'string') texts.set(this.uri, content);
    }
    text() {
      return Promise.resolve(texts.get(this.uri) ?? '');
    }
    // Real code hands this straight to write() — only .length is read here.
    bytesSync() {
      return { length: sizes.get(this.uri) ?? 0 };
    }
    rename(newName: string) {
      const dir = this.uri.slice(0, this.uri.lastIndexOf('/'));
      const dest = `${dir}/${newName}`;
      sizes.set(dest, sizes.get(this.uri) ?? 0);
      const t = texts.get(this.uri);
      if (t !== undefined) texts.set(dest, t);
      sizes.delete(this.uri);
      texts.delete(this.uri);
      this.uri = dest;
    }
  }
  (File as any).downloadFileAsync = jest.fn();

  class Directory {
    uri: string;
    constructor(...segs: any[]) {
      this.uri = join(segs);
    }
    get exists() {
      return true;
    }
    create() {}
  }

  const Paths = { document: { uri: 'file:///docs/' } };

  return { File, Directory, Paths, __sizes: sizes, __texts: texts };
});

import {
  downloadModelPart,
  downloadedPartPath,
  deleteModelPartFiles,
} from '../modelDownload';

const efs = jest.requireMock('expo-file-system') as any;
const sizes: Map<string, number> = efs.__sizes;
const texts: Map<string, string> = efs.__texts;
const downloadFileAsync = efs.File.downloadFileAsync as jest.Mock;

// Stand up a fake remote: HEAD advertises size/ranges/validator, and
// downloadFileAsync simulates writing the requested range (or the whole file
// when ranges aren't honored) into the mock filesystem.
const setupRemote = ({
  total,
  honorsRanges = true,
  etag = '"v1"',
}: {
  total: number;
  honorsRanges?: boolean;
  etag?: string | null;
}) => {
  (globalThis as any).fetch = jest.fn(async (_url: string, opts: any) => {
    if (opts?.method !== 'HEAD') {
      throw new Error(`unexpected fetch method ${opts?.method}`);
    }
    const headers = new Map<string, string>([
      ['content-length', String(total)],
      ['accept-ranges', honorsRanges ? 'bytes' : 'none'],
    ]);
    if (etag) headers.set('etag', etag);
    return { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null } };
  });

  downloadFileAsync.mockImplementation(
    async (_url: string, dest: any, options: any) => {
      if (options?.signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      }
      const range: string | undefined = options?.headers?.Range;
      let bytes: number;
      if (range && honorsRanges) {
        const [start, end] = range.replace('bytes=', '').split('-').map(Number);
        bytes = end - start + 1;
      } else {
        bytes = total; // range absent or ignored -> whole file
      }
      sizes.set(dest.uri, bytes);
      options?.onProgress?.({ bytesWritten: bytes, totalBytes: bytes });
      return dest;
    },
  );
};

const rangesRequested = () =>
  downloadFileAsync.mock.calls
    .map(call => call[2]?.headers?.Range)
    .filter(Boolean);

const noSignal = () => new AbortController().signal;

beforeEach(() => {
  sizes.clear();
  texts.clear();
  downloadFileAsync.mockReset();
});

test('downloads a fresh file in chunks and publishes it atomically', async () => {
  const total = 40 * MB; // 16 + 16 + 8
  setupRemote({ total });
  const progress: Array<[number, number]> = [];

  const path = await downloadModelPart(
    'https://x/chat-model.gguf',
    'chat-model.gguf',
    noSignal(),
    (d, t) => progress.push([d, t]),
  );

  expect(path).toBe('/docs/models/chat-model.gguf');
  expect(sizes.get(`${MODELS}/chat-model.gguf`)).toBe(total);
  // Scaffolding is cleaned up once published.
  expect(sizes.has(`${MODELS}/chat-model.gguf.partial`)).toBe(false);
  expect(sizes.has(`${MODELS}/chat-model.gguf.chunk`)).toBe(false);
  expect(sizes.has(`${MODELS}/chat-model.gguf.etag`)).toBe(false);
  expect(rangesRequested()).toEqual([
    `bytes=0-${16 * MB - 1}`,
    `bytes=${16 * MB}-${32 * MB - 1}`,
    `bytes=${32 * MB}-${40 * MB - 1}`,
  ]);
  // Every Range must be well-formed integers — never `bytes=null-…` (which iOS
  // produced from a missing file's null .size, and HF rejects with HTTP 400).
  rangesRequested().forEach(r => expect(r).toMatch(/^bytes=\d+-\d+$/));
  expect(progress[progress.length - 1]).toEqual([total, total]);
});

test('resumes from the bytes already on disk', async () => {
  const total = 40 * MB;
  setupRemote({ total, etag: '"v1"' });
  // A previous attempt left 16 MiB + a matching validator.
  sizes.set(`${MODELS}/chat-model.gguf.partial`, 16 * MB);
  sizes.set(`${MODELS}/chat-model.gguf.etag`, 4);
  texts.set(`${MODELS}/chat-model.gguf.etag`, '"v1"');

  await downloadModelPart(
    'https://x/chat-model.gguf',
    'chat-model.gguf',
    noSignal(),
    () => {},
  );

  // Only the missing tail is fetched — not the whole file.
  expect(rangesRequested()).toEqual([
    `bytes=${16 * MB}-${32 * MB - 1}`,
    `bytes=${32 * MB}-${40 * MB - 1}`,
  ]);
  expect(sizes.get(`${MODELS}/chat-model.gguf`)).toBe(total);
});

test('discards a stale partial when the remote file changed', async () => {
  const total = 40 * MB;
  setupRemote({ total, etag: '"v2"' }); // remote now serves a different version
  sizes.set(`${MODELS}/chat-model.gguf.partial`, 16 * MB);
  sizes.set(`${MODELS}/chat-model.gguf.etag`, 4);
  texts.set(`${MODELS}/chat-model.gguf.etag`, '"v1"');

  await downloadModelPart(
    'https://x/chat-model.gguf',
    'chat-model.gguf',
    noSignal(),
    () => {},
  );

  // Validator mismatch -> restart from byte 0 rather than append onto old bytes.
  expect(rangesRequested()).toEqual([
    `bytes=0-${16 * MB - 1}`,
    `bytes=${16 * MB}-${32 * MB - 1}`,
    `bytes=${32 * MB}-${40 * MB - 1}`,
  ]);
  expect(sizes.get(`${MODELS}/chat-model.gguf`)).toBe(total);
});

test('falls back to a single download when the server has no range support', async () => {
  const total = 40 * MB;
  setupRemote({ total, honorsRanges: false });

  const path = await downloadModelPart(
    'https://x/chat-model.gguf',
    'chat-model.gguf',
    noSignal(),
    () => {},
  );

  expect(path).toBe('/docs/models/chat-model.gguf');
  expect(downloadFileAsync).toHaveBeenCalledTimes(1);
  // One shot straight to the final file, no Range header.
  expect(downloadFileAsync.mock.calls[0][1].uri).toBe(`${MODELS}/chat-model.gguf`);
  expect(downloadFileAsync.mock.calls[0][2].headers).toBeUndefined();
  expect(sizes.get(`${MODELS}/chat-model.gguf`)).toBe(total);
});

test('returns immediately when the file is already installed', async () => {
  setupRemote({ total: 40 * MB });
  sizes.set(`${MODELS}/chat-model.gguf`, 40 * MB);

  const path = await downloadModelPart(
    'https://x/chat-model.gguf',
    'chat-model.gguf',
    noSignal(),
    () => {},
  );

  expect(path).toBe('/docs/models/chat-model.gguf');
  expect(downloadFileAsync).not.toHaveBeenCalled();
  // No need to even hit the network (no HEAD) for an installed model.
  expect((globalThis as any).fetch).not.toHaveBeenCalled();
});

test('an abort stops the loop and keeps the partial for a later resume', async () => {
  const total = 40 * MB;
  setupRemote({ total });
  const controller = new AbortController();

  // Abort right after the first chunk lands.
  const base = downloadFileAsync.getMockImplementation()!;
  let calls = 0;
  downloadFileAsync.mockImplementation(async (url: any, dest: any, options: any) => {
    const result = await base(url, dest, options);
    if (++calls === 1) controller.abort();
    return result;
  });

  await expect(
    downloadModelPart(
      'https://x/chat-model.gguf',
      'chat-model.gguf',
      controller.signal,
      () => {},
    ),
  ).rejects.toThrow();

  // Nothing published; the first chunk is retained on disk to resume from.
  expect(sizes.has(`${MODELS}/chat-model.gguf`)).toBe(false);
  expect(sizes.get(`${MODELS}/chat-model.gguf.partial`)).toBe(16 * MB);
  // Transient chunk file is cleaned up even on the error path.
  expect(sizes.has(`${MODELS}/chat-model.gguf.chunk`)).toBe(false);
});

test('downloadedPartPath returns a path only once the file exists', () => {
  expect(downloadedPartPath('chat-model.gguf')).toBeNull();
  sizes.set(`${MODELS}/chat-model.gguf`, 1);
  expect(downloadedPartPath('chat-model.gguf')).toBe('/docs/models/chat-model.gguf');
});

test('deleteModelPartFiles clears the file and its resume scaffolding', () => {
  const names = [
    'chat-model.gguf',
    'chat-model.gguf.partial',
    'chat-model.gguf.chunk',
    'chat-model.gguf.etag',
  ];
  names.forEach(n => sizes.set(`${MODELS}/${n}`, 1));

  deleteModelPartFiles(['chat-model.gguf']);

  names.forEach(n => expect(sizes.has(`${MODELS}/${n}`)).toBe(false));
});
