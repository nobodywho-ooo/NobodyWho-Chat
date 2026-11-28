// The Live Activity factory: records what is started, updated and ended.
const mockInstances: any[] = [];
const mockStart = jest.fn((props: unknown) => {
  const instance = {
    props,
    update: jest.fn(async (next: unknown) => {
      instance.props = next;
    }),
    end: jest.fn(async () => {}),
  };
  mockInstances.push(instance);
  return instance;
});
const mockGetInstances = jest.fn((): any[] => []);

jest.mock('../downloadActivity/ModelDownloadActivity', () => ({
  __esModule: true,
  default: { start: mockStart, getInstances: mockGetInstances },
}));
jest.mock('expo-widgets', () => ({ after: (date: Date) => ({ after: date }) }));

// Plain keys and the count, so the test reads what reaches the activity.
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  },
}));

const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

// Fresh module state (one activity at a time) for each test, on `os`.
const load = (os: 'ios' | 'android' = 'ios') => {
  let loaded: typeof import('../downloadActivity') | undefined;
  // The import of react-native is lazy, so the module reads the shared one.
  jest.replaceProperty(require('react-native').Platform, 'OS', os);
  jest.isolateModules(() => {
    loaded = require('../downloadActivity');
  });
  return loaded as typeof import('../downloadActivity');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInstances.length = 0;
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('starts one activity for a download and follows its progress', async () => {
  const { reportDownloadActivity } = load();

  reportDownloadActivity(1, { name: 'Qwen', progress: 0.1, sizeGB: 1 });
  expect(mockStart).toHaveBeenCalledWith({
    title: 'Qwen',
    subtitle: 'liveActivity.downloading',
    progress: 0.1,
    percent: '10%',
    icon: 'arrow.down.circle.fill',
  });

  // Throttled: the next push waits for the interval.
  reportDownloadActivity(1, { name: 'Qwen', progress: 0.5, sizeGB: 1 });
  expect(mockInstances[0].update).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  await flush();
  expect(mockInstances[0].update).toHaveBeenCalledWith(
    expect.objectContaining({ progress: 0.5, percent: '50%' }),
  );
  expect(mockStart).toHaveBeenCalledTimes(1);
});

test('combines several downloads, weighted by size', async () => {
  const { reportDownloadActivity } = load();

  reportDownloadActivity(1, { name: 'Big', progress: 0.5, sizeGB: 3 });
  jest.advanceTimersByTime(1000);
  reportDownloadActivity(2, { name: 'Small', progress: 1, sizeGB: 1 });
  jest.advanceTimersByTime(1000);
  await flush();

  expect(mockInstances[0].props).toEqual(
    expect.objectContaining({
      title: 'liveActivity.models:2',
      progress: 0.625,
      percent: '62%',
    }),
  );
});

test('shows a download held until the app is back as waiting', async () => {
  const { reportDownloadActivity } = load();

  reportDownloadActivity(1, {
    name: 'Qwen',
    progress: 0.4,
    sizeGB: 1,
    status: 'waiting',
  });

  expect(mockStart).toHaveBeenCalledWith(
    expect.objectContaining({
      subtitle: 'liveActivity.waiting',
      icon: 'pause.circle.fill',
    }),
  );
});

test('ends as downloaded for a while once the last download finishes', async () => {
  const { reportDownloadActivity, finishDownloadActivity } = load();

  reportDownloadActivity(1, { name: 'Qwen', progress: 0.9, sizeGB: 1 });
  finishDownloadActivity(1, 'downloaded');
  await flush();

  expect(mockInstances[0].end).toHaveBeenCalledWith(
    { after: expect.any(Date) },
    expect.objectContaining({
      title: 'Qwen',
      subtitle: 'liveActivity.downloaded',
      progress: 1,
      icon: 'checkmark.circle.fill',
    }),
  );
});

test('removes the activity at once when the download is stopped', async () => {
  const { reportDownloadActivity, finishDownloadActivity } = load();

  reportDownloadActivity(1, { name: 'Qwen', progress: 0.2, sizeGB: 1 });
  finishDownloadActivity(1, 'stopped');
  await flush();

  expect(mockInstances[0].end).toHaveBeenCalledWith('immediate');
});

test('takes over the activity a previous run of the app left', async () => {
  const leftOver = { update: jest.fn(async () => {}), end: jest.fn() };
  mockGetInstances.mockReturnValueOnce([leftOver]);
  const { reportDownloadActivity } = load();

  reportDownloadActivity(1, { name: 'Qwen', progress: 0.3, sizeGB: 1 });
  await flush();

  expect(mockStart).not.toHaveBeenCalled();
  expect(leftOver.update).toHaveBeenCalledWith(
    expect.objectContaining({ percent: '30%' }),
  );
});

test('ends the activities no download backs any more', async () => {
  const orphan = { end: jest.fn(async () => {}) };
  mockGetInstances.mockReturnValueOnce([orphan]);
  const { endOrphanDownloadActivities } = load();

  endOrphanDownloadActivities();
  await flush();

  expect(orphan.end).toHaveBeenCalledWith('immediate');
});

test('does nothing outside iOS', () => {
  const { reportDownloadActivity } = load('android');

  reportDownloadActivity(1, { name: 'Qwen', progress: 0.3, sizeGB: 1 });

  expect(mockStart).not.toHaveBeenCalled();
});
