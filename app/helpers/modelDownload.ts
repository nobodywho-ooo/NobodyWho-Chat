import { Directory, File, Paths } from 'expo-file-system';

import { toPlainPath } from './fileUri';

// Downloaded model files live under <documents>/models
const MODELS_DIR_NAME = 'models';

// A resumable download accumulates bytes into `<fileName>.partial`, pulling each
// window into `<fileName>.chunk` first, and remembers the remote's validator in
// `<fileName>.etag`. Only once every byte is present is `.partial` renamed to
// the final `<fileName>` (an atomic publish) — so `downloadedPartPath` never
// reports a half-downloaded model as installed.
const PARTIAL_SUFFIX = '.partial';
const CHUNK_SUFFIX = '.chunk';
const VALIDATOR_SUFFIX = '.etag';

// How many bytes each ranged request pulls before it is appended to `.partial`.
// This is also the resume granularity: an interrupted chunk re-downloads at most
// this much. Smaller = less waste on flaky networks but more per-request
// overhead; 16 MiB balances the two, and keeps the transient `.chunk`
const CHUNK_BYTES = 16 * 1024 * 1024;

const modelsDirectory = (): Directory => new Directory(Paths.document, MODELS_DIR_NAME);

const ensureModelsDirectory = (): Directory => {
  const dir = modelsDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
};

const deleteIfExists = (file: File): void => {
  if (file.exists) {
    file.delete();
  }
};

// The current absolute plain path for a part file, recomputed against the live
// documents/models dir. Use this at LOAD time instead of a stored absolute
// path: on iOS the sandbox container UUID (and therefore the absolute path)
// changes on every install/update, but the file name does not. Returns the
// path whether or not the file currently exists.
export const modelPartPath = (fileName: string): string =>
  toPlainPath(new File(modelsDirectory(), fileName).uri);

// The plain filesystem path of an already fully-downloaded part, or null if it
// is not present. Used to skip parts that completed on a previous attempt.
export const downloadedPartPath = (fileName: string): string | null => {
  const file = new File(modelsDirectory(), fileName);
  return file.exists ? toPlainPath(file.uri) : null;
};

interface RemoteMeta {
  // Content-Length, or undefined when the server didn't report a size.
  total: number | undefined;
  // Whether the server advertises byte-range support (`Accept-Ranges: bytes`).
  acceptsRanges: boolean;
  // ETag / Last-Modified — a value that changes when the remote bytes change,
  // used to invalidate a stale `.partial` before resuming onto it.
  validator: string | undefined;
}

// A HEAD request tells us the total size
const fetchRemoteMeta = async (
  url: string,
  signal: AbortSignal,
): Promise<RemoteMeta> => {
  const res = await fetch(url, { method: 'HEAD', signal });
  const length = Number(res.headers.get('content-length'));
  const acceptsRanges = (res.headers.get('accept-ranges') ?? '')
    .toLowerCase()
    .includes('bytes');
  const validator =
    res.headers.get('etag') ?? res.headers.get('last-modified') ?? undefined;
  return {
    total: Number.isFinite(length) && length > 0 ? length : undefined,
    acceptsRanges,
    validator,
  };
};

// Used when the server won't do ranges (or won't report a size), so there is nothing to resume
const downloadWholeFile = async (
  url: string,
  finalFile: File,
  partial: File,
  validatorFile: File,
  signal: AbortSignal,
  onProgress: (downloaded: number, total: number) => void,
): Promise<string> => {
  deleteIfExists(partial);
  deleteIfExists(validatorFile);
  const file = await File.downloadFileAsync(url, finalFile, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) =>
      onProgress(bytesWritten, totalBytes),
  });
  return toPlainPath(file.uri);
};

export const downloadModelPart = async (
  url: string,
  fileName: string,
  signal: AbortSignal,
  onProgress: (downloaded: number, total: number) => void,
): Promise<string> => {
  const dir = ensureModelsDirectory();
  const finalFile = new File(dir, fileName);

  if (finalFile.exists) {
    onProgress(finalFile.size, finalFile.size);
    return toPlainPath(finalFile.uri);
  }

  const partial = new File(dir, fileName + PARTIAL_SUFFIX);
  const chunk = new File(dir, fileName + CHUNK_SUFFIX);
  const validatorFile = new File(dir, fileName + VALIDATOR_SUFFIX);

  const meta = await fetchRemoteMeta(url, signal);

  // No range support (or unknown size) — nothing to resume, download in one go.
  if (!meta.acceptsRanges || meta.total === undefined) {
    return downloadWholeFile(
      url,
      finalFile,
      partial,
      validatorFile,
      signal,
      onProgress,
    );
  }

  const total = meta.total;

  // `.size` is only meaningful when the file exists: on iOS reading it for a
  // missing file yields `null` (the native getter throws), which coerces to 0
  // in arithmetic but stringifies to "null" in the Range header below —
  // producing `bytes=null-…`, which the server rejects with HTTP 400. So read
  // it only when the partial exists, and fall back to 0 for anything non-finite.
  let offset = partial.exists ? partial.size : 0;
  if (!Number.isFinite(offset) || offset < 0) {
    offset = 0;
  }

  // Discard a stale `.partial` before appending onto it: either the remote bytes
  // changed since we last wrote (validator mismatch), or the file on disk is
  // somehow longer than the remote — both would corrupt the assembled file.
  if (offset > 0) {
    const storedValidator = validatorFile.exists
      ? (await validatorFile.text()).trim()
      : undefined;
    const remoteChanged =
      meta.validator !== undefined &&
      storedValidator !== undefined &&
      storedValidator !== meta.validator;
    if (remoteChanged || offset > total) {
      deleteIfExists(partial);
      offset = 0;
    }
  }

  // Remember the validator so a future run (even after an app kill) can detect a
  // remote change before resuming.
  if (meta.validator !== undefined) {
    validatorFile.write(meta.validator);
  } else {
    deleteIfExists(validatorFile);
  }

  if (!partial.exists) {
    partial.create();
  }

  onProgress(offset, total);

  try {
    while (offset < total) {
      if (signal.aborted) {
        throw new Error('downloadModelPart aborted');
      }

      const end = Math.min(offset + CHUNK_BYTES, total) - 1;
      const expected = end - offset + 1;

      deleteIfExists(chunk);
      await File.downloadFileAsync(url, chunk, {
        idempotent: true,
        signal,
        headers: { Range: `bytes=${offset}-${end}` },
        onProgress: ({ bytesWritten }) => onProgress(offset + bytesWritten, total),
      });

      // The server must honor the range: the chunk should be exactly the window
      // we asked for. If it isn't (range ignored, short read), don't append the
      // wrong bytes — surface it so the loop stops and the `.partial` is kept.
      if (chunk.size !== expected) {
        throw new Error(
          `downloadModelPart: ranged chunk for ${fileName} was ${chunk.size} bytes, expected ${expected}`,
        );
      }

      partial.write(chunk.bytesSync(), { append: true });
      offset += expected;
      onProgress(offset, total);
    }
  } finally {
    deleteIfExists(chunk);
  }

  partial.rename(fileName);
  deleteIfExists(validatorFile);

  return toPlainPath(finalFile.uri);
};

// Removes a model's downloaded part files (best-effort) — used when a download
// is stopped before it finishes. Clears the completed file plus any leftover
// resume scaffolding (`.partial` / `.chunk` / `.etag`).
export const deleteModelPartFiles = (fileNames: string[]): void => {
  const dir = modelsDirectory();
  fileNames.forEach(name => {
    [
      name,
      name + PARTIAL_SUFFIX,
      name + CHUNK_SUFFIX,
      name + VALIDATOR_SUFFIX,
    ].forEach(candidate => deleteIfExists(new File(dir, candidate)));
  });
};
