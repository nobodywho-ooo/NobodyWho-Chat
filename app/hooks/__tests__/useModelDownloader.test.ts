import { Alert, AppState } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  insertModel,
  updateModelDownloadParts,
} from 'repositories';
import { getAppState, setAppState } from 'database';
import {
  checkDiskSpaceForModel,
  deleteModelDirectory,
  downloadModelPart,
  log,
} from 'helpers';
import { ModelPipeline } from 'types';
import {
  cachedCatalogueModel,
  finishDownloadActivity,
  reportDownloadActivity,
  subscribeChatModelArrival,
} from 'services';
import { HttpStatusError } from '../../helpers/modelDownload';
import { buildModel } from 'jest/factories/model';

import {
  createPartRetryPolicy,
  isDownloadActive,
  MAX_PART_ATTEMPTS,
  RETRY_DELAYS_MS,
  useActiveDownloadIds,
  useModelDownloader,
  useResumeModelDownloads,
} from '../useModelDownloader';

jest.mock('repositories', () => ({
  createModelDownload: jest.fn(async () => true),
  deleteModelDownload: jest.fn(async () => {}),
  getModelDownloads: jest.fn(async () => []),
  insertModel: jest.fn(async () => {}),
  updateModelDownloadParts: jest.fn(async () => {}),
}));

jest.mock('database', () => ({
  DEFAULT_ASSISTANT_CONFIG: {},
  getAppState: jest.fn(() => ({ modelIdInUse: 1 })),
  setAppState: jest.fn(async () => {}),
}));

jest.mock('services', () => ({
  ...jest.requireActual('services'),
  cachedCatalogueModel: jest.fn(() => undefined),
  reportDownloadActivity: jest.fn(),
  finishDownloadActivity: jest.fn(),
  endOrphanDownloadActivities: jest.fn(),
}));

jest.mock('helpers', () => ({
  downloadModelPart: jest.fn(),
  isPermanentDownloadFailure: jest.requireActual('../../helpers/modelDownload')
    .isPermanentDownloadFailure,
  deleteModelDirectory: jest.fn(),
  stopModelTransfers: jest.fn(async () => {}),
  log: jest.fn(),
  // Unit-tested in diskSpace.test.ts; here the default is a device with room,
  // and a test flips it to exercise the refusal.
  checkDiskSpaceForModel: jest.fn(() => ({
    fits: true,
    requiredGB: 1.5,
    availableGB: 64,
  })),
  modelSizeLabel: jest.fn((sizeGB: number) => `${sizeGB} GB`),
  // Unit-tested in ttsVoices.test.ts; here we only care that the auto-select
  // spreads its result into the persisted config.
  resolveTtsPrefs: jest.fn(() => ({})),
}));

const mockGetModelDownloads = getModelDownloads as jest.Mock;
const mockDeleteModelDownload = deleteModelDownload as jest.Mock;
const mockInsertModel = insertModel as jest.Mock;
const mockDownloadModelPart = downloadModelPart as jest.Mock;
const mockDeleteModelDirectory = deleteModelDirectory as jest.Mock;
const mockCheckDiskSpaceForModel = checkDiskSpaceForModel as jest.Mock;
const mockSetAppState = setAppState as jest.Mock;
const mockLog = log as jest.Mock;
const mockCachedCatalogueModel = cachedCatalogueModel as jest.Mock;
const mockReportDownloadActivity = reportDownloadActivity as jest.Mock;
const mockFinishDownloadActivity = finishDownloadActivity as jest.Mock;

// A pending download for a single-part model, keyed by a unique id per test so
// the module-level `activeDownloads` map can't leak state between tests.
const pendingDownload = (
  id: number,
  pipeline: ModelPipeline = ModelPipeline.textGeneration,
) => {
  const model = buildModel(id, {
    pipeline,
    parts: [
      {
        url: `https://x/model-${id}.gguf`,
        fileName: `model-${id}.gguf`,
        type:
          pipeline === ModelPipeline.textToSpeech ? 'tts-file' : 'chat-model',
        path: '',
        sizeGB: 1,
      },
    ],
  });
  return {
    model,
    partsProgress: model.parts.map(part => ({ ...part, progress: 0 })),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps implementations, so undo a previous test's rejection.
  mockInsertModel.mockResolvedValue(undefined);
  mockGetModelDownloads.mockResolvedValue([]);
  (createModelDownload as jest.Mock).mockResolvedValue(true);
  (updateModelDownloadParts as jest.Mock).mockResolvedValue(undefined);
  (setAppState as jest.Mock).mockResolvedValue(undefined);
  (getAppState as jest.Mock).mockReturnValue({ modelIdInUse: 1 });
  mockCachedCatalogueModel.mockReturnValue(undefined);
  mockCheckDiskSpaceForModel.mockReturnValue({
    fits: true,
    requiredGB: 1.5,
    availableGB: 64,
  });
});

test('the download screens leave resuming to useResumeModelDownloads', async () => {
  mockGetModelDownloads.mockResolvedValue([pendingDownload(110)]);

  await renderHook(() => useModelDownloader());
  await act(async () => {});

  expect(mockGetModelDownloads).not.toHaveBeenCalled();
  expect(mockDownloadModelPart).not.toHaveBeenCalled();
});

test('resumes pending downloads again when the app returns to the foreground', async () => {
  // Already a mock in the react-native jest preset.
  const addListener = AppState.addEventListener as jest.Mock;
  mockDownloadModelPart.mockResolvedValue('/docs/models/111/model-111.gguf');

  await renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(mockGetModelDownloads).toHaveBeenCalledTimes(1));
  expect(mockDownloadModelPart).not.toHaveBeenCalled();

  // A download that failed while offline is still pending on the way back.
  mockGetModelDownloads.mockResolvedValue([pendingDownload(111)]);
  const onChange = addListener.mock.calls.find(
    ([type]) => type === 'change',
  )?.[1] as (state: string) => void;
  await act(async () => onChange('active'));

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockGetModelDownloads).toHaveBeenCalledTimes(2);
});

test('keeps the pending download on a transient error so it can resume later', async () => {
  const download = pendingDownload(101);
  mockGetModelDownloads.mockResolvedValue([download]);
  // A network failure mid-download (NOT an abort).
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());
  // The record and the bytes on disk must survive so the foreground resume
  // picks it back up — neither is torn down on a non-abort failure.
  await waitFor(() => expect(mockGetModelDownloads).toHaveBeenCalled());
  expect(mockDeleteModelDownload).not.toHaveBeenCalled();
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
  expect(mockInsertModel).not.toHaveBeenCalled();
});

test('drops, after alerting, a download whose URL the server refuses', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetModelDownloads.mockResolvedValue([pendingDownload(124)]);
  mockDownloadModelPart.mockRejectedValue(
    new HttpStatusError('HEAD https://x/model-124.gguff returned 404', 404),
  );

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockDeleteModelDownload).toHaveBeenCalledWith(124),
  );
  expect(mockDeleteModelDirectory).toHaveBeenCalledWith(124);
  expect(mockInsertModel).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'screens.models.downloadFailedTitle',
    'screens.models.downloadFailedModelMessage',
  );
  alert.mockRestore();
});

test('reports a refused URL again when the user starts it again', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { model } = pendingDownload(125);
  mockDownloadModelPart.mockRejectedValue(
    new HttpStatusError('HEAD https://x/model-125.gguff returned 404', 404),
  );

  const { result } = await renderHook(() => useModelDownloader());
  await act(() => result.current.startDownload(model));
  await act(() => result.current.startDownload(model));

  expect(alert).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});

test('resumes from the URL the catalogue has now, not the one it started from', async () => {
  const download = pendingDownload(126);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockCachedCatalogueModel.mockImplementation((id: number) =>
    id === 126
      ? {
          ...download.model,
          parts: [{ ...download.model.parts[0], url: 'https://y/fixed.gguf' }],
        }
      : undefined,
  );
  mockDownloadModelPart.mockResolvedValue('/docs/models/126/model-126.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDownloadModelPart).toHaveBeenCalledWith(
    126,
    'https://y/fixed.gguf',
    'model-126.gguf',
    expect.anything(),
    expect.any(Function),
    { title: download.model.name },
  );
  expect(mockInsertModel.mock.calls[0][0].parts[0].url).toBe(
    'https://y/fixed.gguf',
  );
});

test('alerts the user when a download fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetModelDownloads.mockResolvedValue([pendingDownload(107)]);
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      'screens.models.downloadFailedTitle',
      'screens.models.downloadFailedModelMessage',
    ),
  );
  alert.mockRestore();
});

test('keeps the failures of resumed downloads quiet when asked', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetModelDownloads.mockResolvedValue([pendingDownload(123)]);
  mockDownloadModelPart.mockRejectedValue(new Error('offline'));

  await renderHook(() => useResumeModelDownloads({ alertOnFailure: false }));

  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());
  await act(async () => {});
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('alerts once for a download that keeps failing on each return to the app', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const addListener = AppState.addEventListener as jest.Mock;
  mockGetModelDownloads.mockResolvedValue([pendingDownload(112)]);
  mockDownloadModelPart.mockRejectedValue(new Error('offline'));

  await renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));

  const onChange = [...addListener.mock.calls]
    .reverse()
    .find(([type]) => type === 'change')?.[1] as (state: string) => void;
  await act(async () => onChange('active'));
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(2));

  expect(alert).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

// The listener useResumeModelDownloads registered on AppState.
const appStateChange = () =>
  [...(AppState.addEventListener as jest.Mock).mock.calls]
    .reverse()
    .find(([type]) => type === 'change')?.[1] as (state: string) => void;

// A part's transfer that is still running, failed or finished by the test.
const pendingPart = () => {
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<string>((_, reject) => {
    fail = reject;
  });
  return { promise, fail: (error: Error) => fail(error) };
};

test('retries right away, without alerting, a part that fails while the app is in the background', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValueOnce('/docs/models/118/model-118.gguf');
  mockGetModelDownloads.mockResolvedValue([pendingDownload(118)]);

  await renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  const onChange = appStateChange();
  await act(async () => onChange('background'));
  await act(async () => first.fail(new Error('connection lost')));

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDownloadModelPart).toHaveBeenCalledTimes(2);
  expect(alert).not.toHaveBeenCalled();
  await act(async () => onChange('active'));
  alert.mockRestore();
});

test('holds a part whose background retry fails too until the app is back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockRejectedValueOnce(new Error('still offline'))
    .mockResolvedValueOnce('/docs/models/124/model-124.gguf');
  mockGetModelDownloads.mockResolvedValue([pendingDownload(124)]);

  await renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  const onChange = appStateChange();
  await act(async () => onChange('background'));
  await act(async () => first.fail(new Error('connection lost')));
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(2));
  // Still running as far as the app is concerned, so the resume skips it.
  expect(isDownloadActive(124)).toBe(true);

  await act(async () => onChange('active'));

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  // Restarted by its own loop only, not again by the resume.
  expect(mockDownloadModelPart).toHaveBeenCalledTimes(3);
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('a caller awaiting a download held in the background gets the outcome of its restart', async () => {
  const { model } = pendingDownload(128);
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockRejectedValueOnce(new Error('still offline'))
    .mockResolvedValueOnce('/docs/models/128/model-128.gguf');

  const { result } = await renderHook(() => {
    useResumeModelDownloads();
    return useModelDownloader();
  });
  let settled = false;
  await act(() => {
    result.current
      .startDownload(model, { alertOnFailure: false })
      .then(() => (settled = true));
  });
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  const onChange = appStateChange();
  await act(async () => onChange('background'));
  await act(async () => first.fail(new Error('connection lost')));
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(2));
  // A batch (onboarding, voice setup) must not read this as a failure.
  expect(settled).toBe(false);

  await act(async () => onChange('active'));

  await waitFor(() => expect(settled).toBe(true));
  expect(mockInsertModel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 128 }),
  );
});

test('drops a download held in the background that the user stopped meanwhile', async () => {
  const { model } = pendingDownload(129);
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockRejectedValueOnce(new Error('still offline'));

  const { result } = await renderHook(() => {
    useResumeModelDownloads();
    return useModelDownloader();
  });
  let started: Promise<void> = Promise.resolve();
  await act(() => {
    started = result.current.startDownload(model);
  });
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  const onChange = appStateChange();
  await act(async () => onChange('background'));
  await act(async () => first.fail(new Error('connection lost')));
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(2));
  await act(async () => {
    result.current.stopDownload(model);
    await started;
  });

  expect(mockDownloadModelPart).toHaveBeenCalledTimes(2);
  expect(mockDeleteModelDirectory).toHaveBeenCalledWith(129);
  expect(isDownloadActive(129)).toBe(false);
  // Leave the app in the foreground for the next tests.
  await act(async () => onChange('active'));
});

test('gives up on a part after MAX_PART_ATTEMPTS, however often the app comes back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockRejectedValue(new Error('still offline'));
  mockGetModelDownloads.mockResolvedValue([pendingDownload(135)]);

  await renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  const onChange = appStateChange();
  await act(async () => onChange('background'));
  await act(async () => first.fail(new Error('connection lost')));
  // Two transfers so far. Each trip back and away again resets the policy's
  // own counts and gives two more, until the cap ends the run.
  for (let trip = 0; trip < (MAX_PART_ATTEMPTS - 2) / 2; trip++) {
    await act(async () => {
      onChange('active');
      onChange('background');
    });
  }

  await waitFor(() => expect(isDownloadActive(135)).toBe(false));
  expect(mockDownloadModelPart).toHaveBeenCalledTimes(MAX_PART_ATTEMPTS);
  // Kept for the next return to the app, which starts a new run.
  expect(mockDeleteModelDownload).not.toHaveBeenCalled();
  mockGetModelDownloads.mockResolvedValue([]);
  await act(async () => onChange('active'));
  alert.mockRestore();
});

describe('a part that fails in the foreground', () => {
  const delays = [...RETRY_DELAYS_MS];
  beforeAll(() => RETRY_DELAYS_MS.fill(0));
  afterAll(() => RETRY_DELAYS_MS.splice(0, delays.length, ...delays));

  // A transfer that received some bytes before the connection gave out.
  const failAfterSomeBytes = (
    _id: number,
    _url: string,
    _file: string,
    _signal: AbortSignal,
    onProgress: (downloaded: number, total: number) => void,
  ) => {
    onProgress(40, 100);
    return Promise.reject(new Error('connection reset'));
  };

  test('is retried, without alerting, once it had received bytes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDownloadModelPart
      .mockImplementationOnce(failAfterSomeBytes)
      .mockResolvedValueOnce('/docs/models/130/model-130.gguf');
    mockGetModelDownloads.mockResolvedValue([pendingDownload(130)]);

    await renderHook(() => useResumeModelDownloads());

    await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
    expect(mockDownloadModelPart).toHaveBeenCalledTimes(2);
    expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  test('is reported, and kept for a later resume, once the retries are used up', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDownloadModelPart.mockImplementation(failAfterSomeBytes);
    mockGetModelDownloads.mockResolvedValue([pendingDownload(131)]);

    await renderHook(() => useResumeModelDownloads());

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'screens.models.downloadFailedTitle',
        'screens.models.downloadFailedModelMessage',
      ),
    );
    expect(mockDownloadModelPart).toHaveBeenCalledTimes(
      RETRY_DELAYS_MS.length + 1,
    );
    expect(mockDeleteModelDownload).not.toHaveBeenCalled();
    expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  test('refused after it had started is tried once more before the download is dropped', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const refused = new HttpStatusError('GET returned 403', 403);
    mockDownloadModelPart
      .mockImplementationOnce(
        (...args: Parameters<typeof failAfterSomeBytes>) => {
          args[4](40, 100);
          return Promise.reject(refused);
        },
      )
      .mockResolvedValueOnce('/docs/models/132/model-132.gguf');
    mockGetModelDownloads.mockResolvedValue([pendingDownload(132)]);

    await renderHook(() => useResumeModelDownloads());

    await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
    expect(mockDownloadModelPart).toHaveBeenCalledTimes(2);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});

// The background rules need the AppState listener, so they are covered by the
// hook tests above; these are the decisions made in the foreground.
describe('createPartRetryPolicy in the foreground', () => {
  const delays = [...RETRY_DELAYS_MS];
  beforeAll(() => RETRY_DELAYS_MS.fill(0));
  afterAll(() => RETRY_DELAYS_MS.splice(0, delays.length, ...delays));

  const callbacks = { onWaiting: jest.fn(), onResumed: jest.fn() };
  const dropped = new Error('connection reset');
  const refused = new HttpStatusError('GET returned 403', 403);

  test('retries once per delay a part that had received bytes', async () => {
    const shouldRetry = createPartRetryPolicy(
      new AbortController().signal,
      callbacks,
    );

    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      expect(await shouldRetry(dropped, true)).toBe(true);
    }
    expect(await shouldRetry(dropped, true)).toBe(false);
    expect(callbacks.onWaiting).not.toHaveBeenCalled();
  });

  test('reports at once a part that never got a byte', async () => {
    const shouldRetry = createPartRetryPolicy(
      new AbortController().signal,
      callbacks,
    );

    expect(await shouldRetry(dropped, false)).toBe(false);
  });

  test('retries a refusal once, and only after bytes had arrived', async () => {
    const shouldRetry = createPartRetryPolicy(
      new AbortController().signal,
      callbacks,
    );

    expect(await shouldRetry(refused, false)).toBe(false);
    expect(await shouldRetry(refused, true)).toBe(true);
    expect(await shouldRetry(refused, true)).toBe(false);
  });

  test('never retries a stopped download', async () => {
    const controller = new AbortController();
    const shouldRetry = createPartRetryPolicy(controller.signal, callbacks);
    controller.abort();

    expect(await shouldRetry(dropped, true)).toBe(false);
    expect(await shouldRetry(refused, true)).toBe(false);
  });
});

test('downloads the parts of a model at the same time', async () => {
  const model = buildModel(133, {
    parts: [
      {
        url: 'https://x/a.gguf',
        fileName: 'a.gguf',
        type: 'chat-model',
        path: '',
        sizeGB: 1,
      },
      {
        url: 'https://x/b.gguf',
        fileName: 'b.gguf',
        type: 'mmproj',
        path: '',
        sizeGB: 0.5,
      },
    ],
  });
  const first = pendingPart();
  mockDownloadModelPart
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValueOnce('/docs/models/133/b.gguf');

  const { result } = await renderHook(() => useModelDownloader());
  await act(() => {
    result.current.startDownload(model);
  });

  // The second part started without waiting for the first.
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(2));
  await act(async () => result.current.stopDownload(model));
});

test('follows the download in the Live Activity and ends it with the download', async () => {
  mockDownloadModelPart.mockImplementation(
    async (
      _id: number,
      _url: string,
      _file: string,
      _signal: AbortSignal,
      onProgress: (downloaded: number, total: number) => void,
    ) => {
      onProgress(50, 100);
      return '/docs/models/134/model-134.gguf';
    },
  );
  const { model } = pendingDownload(134);

  const { result } = await renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(model);
  });

  expect(mockReportDownloadActivity).toHaveBeenCalledWith(
    134,
    expect.objectContaining({ name: model.name, progress: 0.5 }),
  );
  expect(mockFinishDownloadActivity).toHaveBeenCalledWith(134, 'downloaded');
});

test('does not start a download its caller gave up on', async () => {
  const controller = new AbortController();
  const { result } = await renderHook(() => useModelDownloader());

  // Cancelled before the row is created...
  controller.abort();
  await act(async () => {
    await result.current.startDownload(pendingDownload(119).model, {
      signal: controller.signal,
    });
  });
  expect(createModelDownload).not.toHaveBeenCalled();

  // ...or while it was being created: the row goes again.
  const late = new AbortController();
  (createModelDownload as jest.Mock).mockImplementationOnce(async () => {
    late.abort();
    return true;
  });
  await act(async () => {
    await result.current.startDownload(pendingDownload(120).model, {
      signal: late.signal,
    });
  });
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(120);
  expect(mockDownloadModelPart).not.toHaveBeenCalled();
});

test('tracks whether a download is running, and resumes an interrupted one on request', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const download = pendingDownload(115);
  let failPart: (error: Error) => void = () => {};
  mockDownloadModelPart.mockImplementation(
    () =>
      new Promise((_, reject) => {
        failPart = reject;
      }),
  );
  mockGetModelDownloads.mockResolvedValue([download]);

  const { result } = await renderHook(() => ({
    downloader: useModelDownloader(),
    isActive: useActiveDownloadIds().has(115),
  }));
  expect(result.current.isActive).toBe(false);

  await act(async () => result.current.downloader.resumeDownloads());
  expect(result.current.isActive).toBe(true);

  await act(async () => failPart(new Error('offline')));
  expect(result.current.isActive).toBe(false);
  expect(alert).toHaveBeenCalledTimes(1);

  // Asked for again: a repeated failure is reported again.
  await act(async () => result.current.downloader.resumeDownloads());
  await act(async () => failPart(new Error('offline')));
  expect(alert).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});

test('checks disk space against what other downloads still have to write', async () => {
  const other = pendingDownload(116);
  mockGetModelDownloads.mockResolvedValue([other]);
  mockCheckDiskSpaceForModel.mockReturnValue({
    fits: false,
    requiredGB: 1.5,
    availableGB: 1,
  });
  const { model } = pendingDownload(117);

  const { result } = await renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(model);
  });

  expect(mockCheckDiskSpaceForModel).toHaveBeenCalledWith(model, [other]);
  expect(mockDownloadModelPart).not.toHaveBeenCalled();
});

test('leaves the space check to a batch that already did it', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Would refuse the model on its own.
  mockCheckDiskSpaceForModel.mockReturnValue({
    fits: false,
    requiredGB: 1.5,
    availableGB: 1,
  });
  mockDownloadModelPart.mockResolvedValue('/docs/models/121/model-121.gguf');
  const { model } = pendingDownload(121);

  const { result } = await renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(model, { skipSpaceCheck: true });
  });

  expect(mockCheckDiskSpaceForModel).not.toHaveBeenCalled();
  expect(createModelDownload).toHaveBeenCalledWith(model);
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('names the models in one alert when a batch does not fit', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { result } = await renderHook(() => useModelDownloader());

  result.current.warnNotEnoughSpace(
    [pendingDownload(113).model, pendingDownload(114).model],
    { fits: false, requiredGB: 4, availableGB: 1 },
  );

  expect(alert).toHaveBeenCalledWith(
    'screens.models.notEnoughSpaceTitle',
    'screens.models.notEnoughSpaceMessage',
  );
  alert.mockRestore();
});

test('leaves the failure alert to a caller that opts out', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  const { result } = await renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(pendingDownload(108).model, {
      alertOnFailure: false,
    });
  });

  expect(mockDownloadModelPart).toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('does not alert when the user stops a download', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { model } = pendingDownload(109);
  mockDownloadModelPart.mockImplementation(
    (_id, _url, _file, signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  );

  const { result } = await renderHook(() => useModelDownloader());
  let started: Promise<void> = Promise.resolve();
  await act(() => {
    started = result.current.startDownload(model);
  });
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());

  await act(async () => {
    result.current.stopDownload(model);
    await started;
  });

  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('a download started again right after a stop waits for the stopped one to end', async () => {
  const { model } = pendingDownload(126);
  let endStopped: (error: Error) => void = () => {};
  mockDownloadModelPart
    // The stopped transfer takes a while to notice the abort.
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          endStopped = reject;
        }),
    )
    .mockResolvedValue('/docs/models/126/model-126.gguf');

  const { result } = await renderHook(() => useModelDownloader());
  let stopped: Promise<void> = Promise.resolve();
  await act(() => {
    stopped = result.current.startDownload(model);
  });
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalledTimes(1));

  let restarted: Promise<void> = Promise.resolve();
  await act(async () => {
    result.current.stopDownload(model);
    restarted = result.current.startDownload(model);
  });
  expect(mockDownloadModelPart).toHaveBeenCalledTimes(1);

  await act(async () => {
    endStopped(new Error('aborted'));
    await stopped;
    await restarted;
  });

  // The stopped loop cleared the folder before the new one wrote to it.
  expect(mockDownloadModelPart).toHaveBeenCalledTimes(2);
  expect(mockDeleteModelDirectory.mock.invocationCallOrder[0]).toBeLessThan(
    mockDownloadModelPart.mock.invocationCallOrder[1],
  );
  expect(mockInsertModel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 126 }),
  );
});

test('an installed model whose slot selection fails is neither reported nor left pending', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (getAppState as jest.Mock).mockReturnValue({});
  mockSetAppState.mockRejectedValue(new Error('database locked'));
  const { model } = pendingDownload(127);
  mockDownloadModelPart.mockResolvedValue('/docs/models/127/model-127.gguf');

  const { result } = await renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(model);
  });

  expect(mockInsertModel).toHaveBeenCalled();
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(127);
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('logs a download failure without reporting it to Sentry', async () => {
  mockGetModelDownloads.mockResolvedValue([pendingDownload(103)]);
  mockDownloadModelPart.mockRejectedValue(new Error('ranged chunk mismatch'));

  await renderHook(() => useResumeModelDownloads());

  // No `{ capture: true }` option: log only prints it.
  await waitFor(() =>
    expect(mockLog).toHaveBeenCalledWith(
      'ModelsScreen runDownload',
      expect.any(Error),
    ),
  );
});

test('installs the model and clears the download on success', async () => {
  const download = pendingDownload(102);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/102/model-102.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(102);
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
});

test('a first chat model fills the empty chat slot on completion', async () => {
  (getAppState as jest.Mock).mockReturnValue({});
  const download = pendingDownload(103);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/103/model-103.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith({
      modelIdInUse: 103,
      conversationIdInUse: undefined,
    }),
  );
});

// The drawer listens to this to open the chat on a new conversation.
test('a first chat model announces its arrival once installed', async () => {
  (getAppState as jest.Mock).mockReturnValue({});
  const onArrival = jest.fn();
  const unsubscribe = subscribeChatModelArrival(onArrival);
  const download = pendingDownload(110);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/110/model-110.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(onArrival).toHaveBeenCalledTimes(1));
  unsubscribe();
});

test('a chat model downloaded beside the one in use does not announce itself', async () => {
  (getAppState as jest.Mock).mockReturnValue({ modelIdInUse: 1 });
  const onArrival = jest.fn();
  const unsubscribe = subscribeChatModelArrival(onArrival);
  const download = pendingDownload(111);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/111/model-111.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockDeleteModelDownload).toHaveBeenCalledWith(111),
  );
  expect(onArrival).not.toHaveBeenCalled();
  unsubscribe();
});

test('a voice model filling its empty slot does not announce a chat model', async () => {
  (getAppState as jest.Mock).mockReturnValue({});
  const onArrival = jest.fn();
  const unsubscribe = subscribeChatModelArrival(onArrival);
  const download = pendingDownload(112, ModelPipeline.textToSpeech);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/112/model-112.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith(
      expect.objectContaining({ ttsModelIdInUse: 112 }),
    ),
  );
  expect(onArrival).not.toHaveBeenCalled();
  unsubscribe();
});

test('a TTS model fills the voice slot — never the chat slot', async () => {
  // No model of either kind selected yet: the strongest bait for the
  // auto-select to wrongly put a voice model in the chat slot.
  (getAppState as jest.Mock).mockReturnValue({});
  const download = pendingDownload(104, ModelPipeline.textToSpeech);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/104/model-104.gguf');

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith(
      expect.objectContaining({ ttsModelIdInUse: 104 }),
    ),
  );
  expect(mockSetAppState).not.toHaveBeenCalledWith(
    expect.objectContaining({ modelIdInUse: 104 }),
  );
});

test('a failing insert drops the download row and files instead of retrying forever', async () => {
  const download = pendingDownload(105);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/105/model-105.gguf');
  // e.g. a stale dev database whose pipeline CHECK predates this model.
  mockInsertModel.mockRejectedValue(new Error('CHECK constraint failed'));

  await renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockDeleteModelDownload).toHaveBeenCalledWith(105),
  );
  expect(mockDeleteModelDirectory).toHaveBeenCalledWith(105);
  expect(mockSetAppState).not.toHaveBeenCalled();
});

describe('startDownload disk-space guard', () => {
  const model = () => buildModel(106, { name: 'Tiny', sizeGB: 4 });

  test('refuses a model that does not fit and tells the user', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCheckDiskSpaceForModel.mockReturnValue({
      fits: false,
      requiredGB: 4.5,
      availableGB: 1,
    });

    const { result } = await renderHook(() => useModelDownloader());
    await act(async () => {
      await result.current.startDownload(model());
    });

    expect(alert).toHaveBeenCalledWith(
      'screens.models.notEnoughSpaceTitle',
      'screens.models.notEnoughSpaceMessage',
    );
    expect(createModelDownload).not.toHaveBeenCalled();
    expect(mockDownloadModelPart).not.toHaveBeenCalled();
  });

  test('starts the download when the model fits', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDownloadModelPart.mockResolvedValue('/docs/models/106/model.gguf');

    const { result } = await renderHook(() => useModelDownloader());
    await act(async () => {
      await result.current.startDownload(
        buildModel(106, {
          parts: [
            {
              url: 'https://x/model.gguf',
              fileName: 'model.gguf',
              type: 'chat-model',
              path: '',
              sizeGB: 1,
            },
          ],
        }),
      );
    });

    expect(alert).not.toHaveBeenCalled();
    expect(createModelDownload).toHaveBeenCalled();
    expect(mockDownloadModelPart).toHaveBeenCalled();
  });
});
