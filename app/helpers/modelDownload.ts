import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import {
  completeHandler,
  createDownloadTask,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask,
  type Headers,
} from '@kesha-antonov/react-native-background-downloader';

import { toPlainPath } from './fileUri';
import { log } from './log';

// Downloaded model files live under <documents>/models/<modelId> — one
// directory per model. Parts reconstruct the model's own file tree inside it
// (a part's fileName may contain subdirectories, e.g. "onnx/vocoder.onnx"), so
// two models can ship identically-named files without colliding, folder-based
// loaders (TTS) can be handed the directory itself, and deleting a model is a
// single recursive directory removal.
const MODELS_DIR_NAME = 'models';

// A part is transferred by the OS (iOS NSURLSession background session, Android
// UIDT job / foreground service) into `<fileName>.download`, so it keeps going
// while the app is in the background or has been terminated. Only once the
// transfer is done is `.download` renamed to the final `<fileName>` (an atomic
// publish) — so `downloadedPartPath` never reports a half-downloaded model as
// installed. `<fileName>.etag` remembers the remote's validator for Android's
// resume-from-file (see RESUME_FROM_FILE_HEADER).
const DOWNLOAD_SUFFIX = '.download';
const VALIDATOR_SUFFIX = '.etag';

// Scaffolding of the previous, foreground-only downloader (ranged chunks
// appended to `.partial`). A download left pending by it restarts on the
// background downloader, so its leftovers are dropped.
const LEGACY_SUFFIXES = ['.partial', '.chunk'];

// Read by the patched Android downloader (patches/@kesha-antonov+react-native-
// background-downloader+*.patch): continue from the bytes already at the
// destination instead of deleting them. Stripped before the request is sent.
// iOS needs no such thing: it keeps a failed transfer's resume data instead.
const RESUME_FROM_FILE_HEADER = 'X-Background-Downloader-Resume';

// How often progress events cross the bridge.
const PROGRESS_INTERVAL_MS = 500;

export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

// The server answered, with an error status: a wrong URL (404), a removed or
// gated file (401/403/410). Unlike a NetworkError, trying again won't help.
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

// The caller's signal stopped the transfer.
export class DownloadAbortedError extends Error {
  constructor(fileName: string) {
    super(`download of ${fileName} was stopped`);
    this.name = 'DownloadAbortedError';
  }
}

export const isPermanentDownloadFailure = (error: unknown): boolean =>
  error instanceof HttpStatusError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 408 &&
  error.status !== 429;

// Both platforms report a server's error status as the failure's errorCode
// (iOS turns a non-2xx response into an error carrying the status, Android's
// downloader uses it directly). Anything else — NSURLError codes (negative),
// Android's transport failures — is the connection, which may come back.
export const toDownloadError = (
  url: string,
  error: string,
  errorCode: number,
): Error =>
  errorCode >= 400 && errorCode < 600
    ? new HttpStatusError(
        `GET ${url} returned ${errorCode}: ${error}`,
        errorCode,
      )
    : new NetworkError(`GET ${url} failed (${errorCode}): ${error}`);

let isConfigured = false;

// The downloader's global settings, applied before the first task.
const configureDownloader = () => {
  if (isConfigured) {
    return;
  }
  isConfigured = true;
  setConfig({
    progressInterval: PROGRESS_INTERVAL_MS,
    // Android: show the download's progress in its mandatory notification rather than a blank one.
    showNotificationsEnabled: true,
    logCallback: (tag, message, ...args) =>
      log('backgroundDownloader', `${tag} ${message}`, ...args),
  });
};

const modelDirectory = (modelId: number): Directory =>
  new Directory(Paths.document, MODELS_DIR_NAME, String(modelId));

// The plain filesystem path of a model's directory, what folder-based loaders (e.g. Tts.load's `source`) receive.
export const modelDirectoryPath = (modelId: number): string =>
  toPlainPath(modelDirectory(modelId).uri);

// A TTS model ships the voices (and, for pocket-tts, the language bundles) it
// actually supports as files inside its own folder, so the picker enumerates
// them from disk rather than from a hardcoded list — see the per-engine
// vocabularies in ttsEngine.ts. Names are returned numerically-aware sorted so
// "M10" follows "M2", and [] when the folder is absent (model not downloaded,
// or one that ships no such folder) or unreadable.
const listEntries = (
  modelId: number,
  dirName: string,
  pick: (entry: File | Directory) => string | undefined,
): string[] => {
  const dir = new Directory(modelDirectory(modelId), dirName);

  if (!dir.exists) {
    return [];
  }

  try {
    return dir
      .list()
      .map(pick)
      .filter((name): name is string => name !== undefined)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    log('listModelFolder', error, { capture: true });
    return [];
  }
};

// The basenames of the files in `<model dir>/<dirName>` carrying `extension`,
// with the extension stripped: Supertonic's voice_styles/M1.json → "M1",
// Kokoro's voices/bf_emma.safetensors → "bf_emma". Anything else in the folder
// (READMEs, licences) is skipped.
export const listModelFiles = (
  modelId: number,
  dirName: string,
  extension: string,
): string[] =>
  listEntries(modelId, dirName, entry =>
    entry instanceof File && entry.name.toLowerCase().endsWith(extension)
      ? entry.name.slice(0, -extension.length)
      : undefined,
  );

// The subdirectory names in `<model dir>/<dirName>` — pocket-tts ships one
// per language bundle (onnx/english_2026-04, onnx/german, …).
export const listModelSubdirectories = (
  modelId: number,
  dirName: string,
): string[] =>
  listEntries(modelId, dirName, entry =>
    entry instanceof Directory ? entry.name : undefined,
  );

// Part fileNames come from the remote catalogue, which is parsed without
// validation — refuse anything that could resolve outside the model directory.
// Returns the path split into its segments. Exported only for direct unit
// testing; callers should go through downloadModelPart/downloadedPartPath.
export const assertSafeRelativePath = (fileName: string): string[] => {
  const segments = fileName.split('/');
  if (
    fileName.includes('\\') ||
    segments.some(
      segment => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`modelDownload: unsafe part fileName "${fileName}"`);
  }
  return segments;
};

// Where a part's final file (and its download scaffolding) lives: the
// directory holding it, and its name inside that directory. Nested targets are
// resolved segment by segment — the Directory constructor joins variadic
// segments, and rename() below only accepts a bare name within the same
// directory. Exported only for direct unit testing.
export const locatePart = (
  modelId: number,
  fileName: string,
): { parentDir: Directory; baseName: string } => {
  const segments = assertSafeRelativePath(fileName);
  const parentDir =
    segments.length > 1
      ? new Directory(modelDirectory(modelId), ...segments.slice(0, -1))
      : modelDirectory(modelId);
  return { parentDir, baseName: segments[segments.length - 1] };
};

// The background task's id for a part: stable across launches, so a relaunched
// app finds the transfer it started. Also a file name on iOS (its resume data),
// hence no slashes.
export const partTaskId = (modelId: number, fileName: string): string =>
  `model-${modelId}-${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;

const deleteIfExists = (file: File): void => {
  if (file.exists) {
    file.delete();
  }
};

// The plain filesystem path of an already fully-downloaded part, or null if it
// is not present. Used to skip parts that completed on a previous attempt.
export const downloadedPartPath = (
  modelId: number,
  fileName: string,
): string | null => {
  const { parentDir, baseName } = locatePart(modelId, fileName);
  const file = new File(parentDir, baseName);

  return file.exists ? toPlainPath(file.uri) : null;
};

const existingTasks = async (): Promise<Map<string, DownloadTask>> => {
  try {
    const tasks = await getExistingDownloadTasks();
    return new Map(tasks.map(task => [task.id, task]));
  } catch (error) {
    log('modelDownload getExistingDownloadTasks', error);
    return new Map();
  }
};

export const stopModelTransfers = async (modelId: number): Promise<void> => {
  const prefix = `model-${modelId}-`;
  const tasks = await existingTasks();

  await Promise.all(
    [...tasks.values()]
      .filter(task => task.id.startsWith(prefix))
      .map(task =>
        task.stop().catch(error => log('stopModelTransfers', error)),
      ),
  );
};

const headerValue = (headers: Headers, name: string): string | undefined => {
  const key = Object.keys(headers).find(
    candidate => candidate.toLowerCase() === name,
  );
  const value = key === undefined ? undefined : headers[key];
  return value ?? undefined;
};

// `If-Range` only takes a strong ETag: a weak one (W/"…") can't vouch for the
// exact bytes, so without it the server would always resend everything.
const strongEtag = (headers: Headers): string | undefined => {
  const etag = headerValue(headers, 'etag');
  return etag !== undefined && !etag.startsWith('W/') ? etag : undefined;
};

export interface DownloadPartOptions {
  // Shown in the Android download notification.
  title?: string;
}

// Downloads one part of a model in the background and resolves with its final
// path. Survives the app being suspended or terminated
export const downloadModelPart = async (
  modelId: number,
  url: string,
  fileName: string,
  signal: AbortSignal,
  onProgress: (downloaded: number, total: number) => void,
  { title }: DownloadPartOptions = {},
): Promise<string> => {
  const { parentDir, baseName } = locatePart(modelId, fileName);

  if (!parentDir.exists) {
    parentDir.create({ intermediates: true });
  }

  const finalFile = new File(parentDir, baseName);

  if (finalFile.exists) {
    onProgress(finalFile.size, finalFile.size);
    return toPlainPath(finalFile.uri);
  }

  if (signal.aborted) {
    throw new DownloadAbortedError(fileName);
  }

  for (const suffix of LEGACY_SUFFIXES) {
    deleteIfExists(new File(parentDir, baseName + suffix));
  }

  configureDownloader();

  const download = new File(parentDir, baseName + DOWNLOAD_SUFFIX);
  const validatorFile = new File(parentDir, baseName + VALIDATOR_SUFFIX);
  const id = partTaskId(modelId, fileName);
  const existing = (await existingTasks()).get(id);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let task: DownloadTask | undefined = existing;

    const settle = (outcome: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener('abort', onAbort);
      outcome();
    };

    const release = () => {
      try {
        completeHandler(id);
      } catch (error) {
        log('modelDownload completeHandler', error);
      }
    };

    const onDone = () => {
      release();
      settle(() => {
        try {
          if (!download.exists) {
            throw new Error(
              `modelDownload: ${fileName} finished but ${download.uri} is missing`,
            );
          }

          download.rename(baseName);
          deleteIfExists(validatorFile);
          onProgress(finalFile.size, finalFile.size);
          resolve(toPlainPath(finalFile.uri));
        } catch (error) {
          reject(error);
        }
      });
    };

    const onError = ({
      error,
      errorCode,
    }: {
      error: string;
      errorCode: number;
    }) => {
      release();
      settle(() => {
        // Asked to continue a file the server says is already whole (or that
        // no longer matches it): its bytes can't be trusted, start over.
        if (errorCode === 416) {
          deleteIfExists(download);
          deleteIfExists(validatorFile);
        }
        reject(toDownloadError(url, error, errorCode));
      });
    };

    function onAbort() {
      settle(() => {
        task
          ?.stop()
          .catch(error => log('modelDownload stop', error))
          .finally(() => {
            deleteIfExists(download);
            deleteIfExists(validatorFile);
          });
        reject(new DownloadAbortedError(fileName));
      });
    }

    const attach = (target: DownloadTask) =>
      target
        .begin(({ headers }) => {
          const etag = strongEtag(headers);
          try {
            if (etag !== undefined) {
              validatorFile.write(etag);
            } else {
              deleteIfExists(validatorFile);
            }
          } catch (error) {
            log('modelDownload validator', error);
          }
        })
        .progress(({ bytesDownloaded, bytesTotal }) => {
          if (!settled) {
            onProgress(bytesDownloaded, bytesTotal);
          }
        })
        .done(onDone)
        .error(onError);

    signal.addEventListener('abort', onAbort);

    try {
      if (existing) {
        attach(existing);

        switch (existing.state) {
          case 'DONE':
            onDone();
            return;
          case 'PAUSED':
            existing.resume().catch(error => {
              log('modelDownload resume', error);
              onError({ error: String(error), errorCode: -1 });
            });
            break;
          default:
            if (existing.bytesTotal > 0) {
              onProgress(existing.bytesDownloaded, existing.bytesTotal);
            }
        }
        return;
      }

      // iOS writes the destination only by moving the finished file there, so
      // one without a task finished while no JS was listening (the app was
      // terminated, or relaunched in the background before re-attaching).
      if (Platform.OS === 'ios' && download.exists && download.size > 0) {
        onDone();
        return;
      }

      const headers: Headers = {};

      // Android writes the destination as bytes arrive: a file without a task
      // is what an earlier, failed transfer received. Continue from it; the
      // If-Range makes the server send the whole file again if it changed.
      if (Platform.OS === 'android' && download.exists && download.size > 0) {
        headers[RESUME_FROM_FILE_HEADER] = '1';
        const etag = validatorFile.exists
          ? validatorFile.textSync().trim()
          : undefined;
        if (etag) {
          headers['If-Range'] = etag;
        }
      } else {
        deleteIfExists(download);
      }

      task = createDownloadTask({
        id,
        url,
        destination: toPlainPath(download.uri),
        headers,
        metadata: { modelId, fileName },
        notificationTitle: title,
      });
      attach(task);
      task.start();
    } catch (error) {
      settle(() => reject(error));
    }
  });
};

export const deleteModelDirectory = (modelId: number): void => {
  const dir = modelDirectory(modelId);
  if (dir.exists) {
    dir.delete();
  }
};
