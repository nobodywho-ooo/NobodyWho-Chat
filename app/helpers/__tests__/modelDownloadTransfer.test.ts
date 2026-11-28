// Download/transfer coverage for helpers/modelDownload: background tasks,
// re-attaching after a relaunch, resuming from what a failed transfer kept,
// error classification, abort and path-traversal safety.
//
// Separate from modelDownload.test.ts because this file overrides expo-file-system
// with a stateful in-memory mock, while the listVoiceStyles tests there rely on
// the shared mock from jest/mock. jest.mock is per-file and hoisted, so the two
// cannot share one file.

import { Platform } from 'react-native';

const MODEL_ID = 7;
// Every model gets its own directory under <documents>/models.
const MODEL_DIR = `file:///docs/models/${MODEL_ID}`;

// A stateful in-memory expo-file-system mock: a path -> byte-size map (plus
// text contents for the validator file).
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
    get size() {
      return sizes.has(this.uri) ? (sizes.get(this.uri) as number) : null;
    }
    delete() {
      sizes.delete(this.uri);
      texts.delete(this.uri);
    }
    write(content: string) {
      sizes.set(this.uri, content.length);
      texts.set(this.uri, content);
    }
    textSync() {
      return texts.get(this.uri) ?? '';
    }
    rename(newName: string) {
      const dir = this.uri.slice(0, this.uri.lastIndexOf('/'));
      const dest = `${dir}/${newName}`;
      sizes.set(dest, sizes.get(this.uri) ?? 0);
      sizes.delete(this.uri);
      texts.delete(this.uri);
      this.uri = dest;
    }
  }

  class Directory {
    uri: string;
    constructor(...segs: any[]) {
      this.uri = join(segs);
    }
    get exists() {
      return true;
    }
    create() {}
    // Matches the real API: removes the directory tree recursively.
    delete() {
      const prefix = `${this.uri.replace(/\/+$/, '')}/`;
      [...sizes.keys()]
        .filter(uri => uri.startsWith(prefix))
        .forEach(uri => {
          sizes.delete(uri);
          texts.delete(uri);
        });
    }
  }

  const Paths = { document: { uri: 'file:///docs/' } };

  return { File, Directory, Paths, __sizes: sizes, __texts: texts };
});

// The background downloader: tasks record their handlers so a test can play
// the native events (begin, progress, done, error) to them.
jest.mock('@kesha-antonov/react-native-background-downloader', () => {
  const created: any[] = [];
  let existing: any[] = [];

  const makeTask = (id: string, state = 'PENDING', extra = {}) => {
    const task: any = {
      id,
      state,
      bytesDownloaded: 0,
      bytesTotal: 0,
      handlers: {},
      ...extra,
    };
    for (const name of ['begin', 'progress', 'done', 'error']) {
      task[name] = jest.fn((handler: unknown) => {
        task.handlers[name] = handler;
        return task;
      });
    }
    task.start = jest.fn();
    task.stop = jest.fn(async () => {});
    task.resume = jest.fn(async () => {});
    return task;
  };

  return {
    createDownloadTask: jest.fn((options: any) => {
      const task = makeTask(options.id);
      task.options = options;
      created.push(task);
      return task;
    }),
    getExistingDownloadTasks: jest.fn(async () => existing),
    completeHandler: jest.fn(),
    setConfig: jest.fn(),
    __created: created,
    __setExisting: (tasks: any[]) => {
      existing = tasks;
    },
    __makeTask: makeTask,
  };
});

import {
  downloadModelPart,
  downloadedPartPath,
  deleteModelDirectory,
  modelDirectoryPath,
  assertSafeRelativePath,
  locatePart,
  partTaskId,
  stopModelTransfers,
  toDownloadError,
  DownloadAbortedError,
  NetworkError,
  HttpStatusError,
  isPermanentDownloadFailure,
} from '../modelDownload';

const efs = jest.requireMock('expo-file-system') as any;
const sizes: Map<string, number> = efs.__sizes;
const texts: Map<string, string> = efs.__texts;
const downloader = jest.requireMock(
  '@kesha-antonov/react-native-background-downloader',
) as any;
const created: any[] = downloader.__created;

const URL = 'https://example.com/model.gguf';
const FILE = 'model.gguf';
const finalUri = `${MODEL_DIR}/${FILE}`;
const downloadUri = `${MODEL_DIR}/${FILE}.download`;
const etagUri = `${MODEL_DIR}/${FILE}.etag`;

// Starts a part's download and waits until its task is set up.
const start = async ({
  signal = new AbortController().signal,
  onProgress = jest.fn(),
  fileName = FILE,
}: {
  signal?: AbortSignal;
  onProgress?: jest.Mock;
  fileName?: string;
} = {}) => {
  const promise = downloadModelPart(
    MODEL_ID,
    URL,
    fileName,
    signal,
    onProgress,
    { title: 'Model' },
  );
  promise.catch(() => {});
  // getExistingDownloadTasks is awaited before the task is created.
  await new Promise<void>(resolve => setImmediate(() => resolve()));
  return { promise, onProgress };
};

// The native side finished the transfer: the file is at its destination.
const finish = (task: any, bytes = 100) => {
  sizes.set(downloadUri, bytes);
  task.handlers.done({
    location: downloadUri,
    bytesDownloaded: bytes,
    bytesTotal: bytes,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  sizes.clear();
  texts.clear();
  created.length = 0;
  downloader.__setExisting([]);
  jest.replaceProperty(Platform, 'OS', 'ios');
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('downloads a fresh part in a background task and publishes it atomically', async () => {
  const { promise, onProgress } = await start();

  expect(created).toHaveLength(1);
  const [task] = created;
  expect(task.options).toEqual(
    expect.objectContaining({
      id: partTaskId(MODEL_ID, FILE),
      url: URL,
      destination: '/docs/models/7/model.gguf.download',
      notificationTitle: 'Model',
      headers: {},
    }),
  );
  expect(task.start).toHaveBeenCalled();

  task.handlers.progress({ bytesDownloaded: 40, bytesTotal: 100 });
  expect(onProgress).toHaveBeenCalledWith(40, 100);
  // Not installed while it transfers.
  expect(downloadedPartPath(MODEL_ID, FILE)).toBeNull();

  finish(task);

  await expect(promise).resolves.toBe('/docs/models/7/model.gguf');
  expect(sizes.has(downloadUri)).toBe(false);
  expect(sizes.get(finalUri)).toBe(100);
  expect(onProgress).toHaveBeenLastCalledWith(100, 100);
  expect(downloader.completeHandler).toHaveBeenCalledWith(task.id);
});

test('returns a part that is already downloaded without a transfer', async () => {
  sizes.set(finalUri, 100);

  await expect(
    downloadModelPart(
      MODEL_ID,
      URL,
      FILE,
      new AbortController().signal,
      jest.fn(),
    ),
  ).resolves.toBe('/docs/models/7/model.gguf');
  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
});

test('re-attaches to the transfer the OS kept running after a relaunch', async () => {
  const running = downloader.__makeTask(
    partTaskId(MODEL_ID, FILE),
    'DOWNLOADING',
    {
      bytesDownloaded: 30,
      bytesTotal: 100,
    },
  );
  downloader.__setExisting([running]);

  const { promise, onProgress } = await start();

  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
  expect(onProgress).toHaveBeenCalledWith(30, 100);
  finish(running);
  await expect(promise).resolves.toBe('/docs/models/7/model.gguf');
});

test('continues a transfer the OS paused (force-quit, failure with resume data)', async () => {
  const paused = downloader.__makeTask(partTaskId(MODEL_ID, FILE), 'PAUSED');
  downloader.__setExisting([paused]);

  const { promise } = await start();

  expect(paused.resume).toHaveBeenCalled();
  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
  finish(paused);
  await expect(promise).resolves.toBe('/docs/models/7/model.gguf');
});

test('installs a transfer that finished while no JS was listening', async () => {
  const done = downloader.__makeTask(partTaskId(MODEL_ID, FILE), 'DONE');
  downloader.__setExisting([done]);
  sizes.set(downloadUri, 100);

  await expect((await start()).promise).resolves.toBe(
    '/docs/models/7/model.gguf',
  );
  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
});

test('on iOS, a finished file without a task is installed as is', async () => {
  sizes.set(downloadUri, 100);

  await expect((await start()).promise).resolves.toBe(
    '/docs/models/7/model.gguf',
  );
  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
});

test('on Android, continues from the bytes a failed transfer left', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  sizes.set(downloadUri, 60);
  texts.set(etagUri, '"abc"');
  sizes.set(etagUri, 5);

  await start();

  expect(created[0].options.headers).toEqual({
    'X-Background-Downloader-Resume': '1',
    'If-Range': '"abc"',
  });
  // The bytes are kept for the downloader to append to.
  expect(sizes.get(downloadUri)).toBe(60);
});

test('remembers a strong ETag for a later resume, never a weak one', async () => {
  await start();
  created[0].handlers.begin({ expectedBytes: 100, headers: { ETag: '"v1"' } });
  expect(texts.get(etagUri)).toBe('"v1"');

  created[0].handlers.begin({
    expectedBytes: 100,
    headers: { etag: 'W/"v2"' },
  });
  expect(sizes.has(etagUri)).toBe(false);
});

test('drops the leftovers of the previous chunked downloader', async () => {
  sizes.set(`${MODEL_DIR}/${FILE}.partial`, 16);
  sizes.set(`${MODEL_DIR}/${FILE}.chunk`, 4);

  await start();

  expect(sizes.has(`${MODEL_DIR}/${FILE}.partial`)).toBe(false);
  expect(sizes.has(`${MODEL_DIR}/${FILE}.chunk`)).toBe(false);
});

test('turns an error status into an HttpStatusError', async () => {
  const { promise } = await start();
  created[0].handlers.error({ error: 'Not Found', errorCode: 404 });

  const error = await promise.catch(e => e);
  expect(error).toBeInstanceOf(HttpStatusError);
  expect(error.status).toBe(404);
  expect(isPermanentDownloadFailure(error)).toBe(true);
  expect(downloader.completeHandler).toHaveBeenCalledWith(created[0].id);
});

test('turns a lost connection into a NetworkError that may pass', async () => {
  const { promise } = await start();
  created[0].handlers.error({
    error: 'The Internet connection appears to be offline.',
    errorCode: -1009,
  });

  const error = await promise.catch(e => e);
  expect(error).toBeInstanceOf(NetworkError);
  expect(isPermanentDownloadFailure(error)).toBe(false);
});

test('starts over when the server says the kept bytes do not fit (416)', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  sizes.set(downloadUri, 120);

  const { promise } = await start();
  created[0].handlers.error({ error: 'Range not satisfiable', errorCode: 416 });

  await expect(promise).rejects.toBeInstanceOf(HttpStatusError);
  expect(sizes.has(downloadUri)).toBe(false);
});

test('an abort stops the transfer and removes what it wrote', async () => {
  const controller = new AbortController();
  const { promise } = await start({ signal: controller.signal });
  sizes.set(downloadUri, 50);

  controller.abort();

  await expect(promise).rejects.toBeInstanceOf(DownloadAbortedError);
  expect(created[0].stop).toHaveBeenCalled();
  await new Promise<void>(resolve => setImmediate(() => resolve()));
  expect(sizes.has(downloadUri)).toBe(false);
});

test('does not start a part whose download was already stopped', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(
    downloadModelPart(MODEL_ID, URL, FILE, controller.signal, jest.fn()),
  ).rejects.toBeInstanceOf(DownloadAbortedError);
  expect(downloader.createDownloadTask).not.toHaveBeenCalled();
});

test('stopModelTransfers stops only the transfers of that model', async () => {
  const mine = downloader.__makeTask(
    partTaskId(MODEL_ID, 'a.gguf'),
    'DOWNLOADING',
  );
  const other = downloader.__makeTask(partTaskId(70, 'a.gguf'), 'DOWNLOADING');
  downloader.__setExisting([mine, other]);

  await stopModelTransfers(MODEL_ID);

  expect(mine.stop).toHaveBeenCalled();
  expect(other.stop).not.toHaveBeenCalled();
});

test('task ids are stable and free of slashes', () => {
  expect(partTaskId(7, 'onnx/vocoder.onnx')).toBe('model-7-onnx_vocoder.onnx');
});

test('toDownloadError keeps statuses and connection failures apart', () => {
  expect(toDownloadError(URL, 'x', 503)).toBeInstanceOf(HttpStatusError);
  expect(isPermanentDownloadFailure(toDownloadError(URL, 'x', 503))).toBe(
    false,
  );
  expect(isPermanentDownloadFailure(toDownloadError(URL, 'x', 429))).toBe(
    false,
  );
  expect(toDownloadError(URL, 'x', -1001)).toBeInstanceOf(NetworkError);
});

describe('paths', () => {
  test('reconstructs nested part paths inside the model directory', async () => {
    const { promise } = await start({ fileName: 'onnx/vocoder.onnx' });
    expect(created[0].options.destination).toBe(
      '/docs/models/7/onnx/vocoder.onnx.download',
    );
    sizes.set(`${MODEL_DIR}/onnx/vocoder.onnx.download`, 10);
    created[0].handlers.done({
      location: '',
      bytesDownloaded: 10,
      bytesTotal: 10,
    });
    await expect(promise).resolves.toBe('/docs/models/7/onnx/vocoder.onnx');
  });

  test('refuses a part fileName that could escape the model directory', async () => {
    for (const fileName of ['../x', 'a/../b', '/abs', 'a\\b', 'a//b', './a']) {
      expect(() => assertSafeRelativePath(fileName)).toThrow(/unsafe/);
    }
    await expect(
      downloadModelPart(
        MODEL_ID,
        URL,
        '../evil',
        new AbortController().signal,
        jest.fn(),
      ),
    ).rejects.toThrow(/unsafe/);
  });

  test('locatePart splits the parent directory from the base name', () => {
    const { parentDir, baseName } = locatePart(MODEL_ID, 'onnx/en/model.onnx');
    expect(parentDir.uri).toBe(`${MODEL_DIR}/onnx/en`);
    expect(baseName).toBe('model.onnx');
  });

  test('modelDirectoryPath is a plain path', () => {
    expect(modelDirectoryPath(MODEL_ID)).toBe('/docs/models/7');
  });

  test('deleteModelDirectory removes the whole model tree', () => {
    sizes.set(finalUri, 1);
    sizes.set(`${MODEL_DIR}/onnx/x.onnx.download`, 1);
    sizes.set('file:///docs/models/8/other.gguf', 1);

    deleteModelDirectory(MODEL_ID);

    expect(sizes.has(finalUri)).toBe(false);
    expect(sizes.has(`${MODEL_DIR}/onnx/x.onnx.download`)).toBe(false);
    expect(sizes.has('file:///docs/models/8/other.gguf')).toBe(true);
  });
});
