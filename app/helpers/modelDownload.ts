import { Directory, File, FileMode, Paths } from 'expo-file-system';

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

// How much of a chunk we move into `.partial` per read/write when appending.
// `downloadFileAsync` can only write a whole file, so a completed chunk has to
// be copied onto the end of `.partial`. Doing that as one 16 MiB `bytesSync()` +
// synchronous `write()` blocks the JS thread and holds the whole chunk in JS
// memory. Streaming it in bounded slices through file handles keeps peak memory
// at one slice and lets the loop yield to the event loop between slices, so a
// multi-GB download doesn't jank the UI.
const APPEND_SLICE_BYTES = 4 * 1024 * 1024;

// A HEAD request should return promptly; if it hangs (dead connection, captive
// portal) the whole download stalls before the first byte, since the fetch
// otherwise only ends when the caller aborts. Bound it independently.
const META_TIMEOUT_MS = 15_000;

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

// Appends `length` bytes from `src` onto the end of `dest`, streaming
// APPEND_SLICE_BYTES at a time so we never buffer the whole (up to CHUNK_BYTES)
// window in JS memory or block the JS thread on one giant read/write. `length`
// is the caller's already-validated chunk size, so the loop is bounded — no
// read-until-EOF. Yields between slices to keep the UI responsive.
const appendFile = async (
  src: File,
  dest: File,
  length: number,
): Promise<void> => {
  const reader = src.open(FileMode.ReadOnly);
  const writer = dest.open(FileMode.Append);
  try {
    for (let copied = 0; copied < length; copied += APPEND_SLICE_BYTES) {
      // readBytes returns the remainder when fewer than a full slice are left.
      writer.writeBytes(reader.readBytes(APPEND_SLICE_BYTES));
      await Promise.resolve();
    }
  } finally {
    reader.close();
    writer.close();
  }
};

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

// A HEAD request tells us the total size, range support and validator. Aborts
// on either the caller's signal (user stopped the download) or META_TIMEOUT_MS
// (the HEAD hung), whichever fires first.
const fetchRemoteMeta = async (
  url: string,
  signal: AbortSignal,
): Promise<RemoteMeta> => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal.aborted) {
    controller.abort();
  } else {
    signal.addEventListener('abort', onAbort);
  }
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
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
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', onAbort);
  }
};

// Used when the server won't do ranges (or won't report a size), so there is
// nothing to resume. Downloads into `.partial` and only renames it to the final
// name once the transfer completes — the same atomic publish the chunked path
// uses. Writing straight to the final file would (on Android, where a failed
// `downloadFileAsync` leaves a partial file behind) leave a truncated file that
// the next run's `finalFile.exists` check would mistake for a finished download.
const downloadWholeFile = async (
  url: string,
  fileName: string,
  finalFile: File,
  partial: File,
  validatorFile: File,
  signal: AbortSignal,
  onProgress: (downloaded: number, total: number) => void,
): Promise<string> => {
  deleteIfExists(partial);
  deleteIfExists(validatorFile);
  await File.downloadFileAsync(url, partial, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) =>
      onProgress(bytesWritten, totalBytes),
  });
  partial.rename(fileName);
  return toPlainPath(finalFile.uri);
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
      fileName,
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
      // we asked for. If it isn't, don't append the wrong bytes.
      if (chunk.size !== expected) {
        // A server can advertise `Accept-Ranges: bytes` yet ignore the Range
        // header and return the full body (chunk === whole file). Ranged resume
        // is impossible against it, and re-requesting the same window would loop
        // forever, so restart cleanly as a single whole-file download. The
        // outer `finally` clears the leftover `.chunk` afterwards.
        if (chunk.size === total) {
          return await downloadWholeFile(
            url,
            fileName,
            finalFile,
            partial,
            validatorFile,
            signal,
            onProgress,
          );
        }
        // Genuine short read / corrupt chunk — surface it so the loop stops and
        // the `.partial` is kept for a later resume.
        throw new Error(
          `downloadModelPart: ranged chunk for ${fileName} was ${chunk.size} bytes, expected ${expected}`,
        );
      }

      await appendFile(chunk, partial, expected);
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
