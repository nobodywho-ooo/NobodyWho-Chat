import { Platform } from 'react-native';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';

import i18n from '../../i18n';
import { log } from '../../helpers/log';
import type {
  ModelDownloadActivityIcon,
  ModelDownloadActivityProps,
} from './ModelDownloadActivity';

// One Live Activity (Lock Screen + Dynamic Island, iOS 16.4+) follows every
// model download in progress: the model's name and its progress, or "2 models"
// and their combined progress. It is driven from JS, so it moves while the app
// runs; once iOS suspends the app the transfer carries on in the system's
// background session but the activity only catches up when the app runs again
// (back in the foreground, or woken by the finished transfer).

type DownloadStatus = 'downloading' | 'waiting';

interface TrackedDownload {
  name: string;
  progress: number;
  status: DownloadStatus;
  // Weight in the combined progress.
  sizeGB: number;
}

export type DownloadActivityOutcome = 'downloaded' | 'failed' | 'stopped';

// Pushes no more often than this, unless the shown percent or status changed.
const MIN_UPDATE_INTERVAL_MS = 1000;

// How long a finished download stays on the Lock Screen.
const DONE_DISMISS_AFTER_MS = 2 * 60 * 1000;

const downloads = new Map<number, TrackedDownload>();

let factory: LiveActivityFactory<ModelDownloadActivityProps> | null | undefined;
let activity: LiveActivity<ModelDownloadActivityProps> | undefined;
let lastProps: ModelDownloadActivityProps | undefined;
let lastPushAt = 0;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

// Live Activity calls are async; chained so an end can't overtake an update.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (work: () => Promise<unknown>) => {
  queue = queue.then(work).catch(error => log('downloadActivity', error));
};

// Loaded lazily, iOS only: the factory registers the layout with the native
// module, which neither Android nor tests have.
const getFactory = () => {
  if (factory !== undefined) {
    return factory;
  }

  factory = null;

  if (Platform.OS !== 'ios') {
    return factory;
  }

  try {
    factory = require('./ModelDownloadActivity').default;
  } catch (error) {
    log('downloadActivity factory', error);
  }

  return factory;
};

const formatPercent = (progress: number) =>
  `${Math.floor(Math.min(Math.max(progress, 0), 1) * 100)}%`;

const combinedProgress = (entries: TrackedDownload[]) => {
  const weight = entries.reduce((sum, entry) => sum + entry.sizeGB, 0);
  if (weight <= 0) {
    return (
      entries.reduce((sum, entry) => sum + entry.progress, 0) / entries.length
    );
  }
  return (
    entries.reduce((sum, entry) => sum + entry.progress * entry.sizeGB, 0) /
    weight
  );
};

const titleFor = (entries: TrackedDownload[]) =>
  entries.length === 1
    ? entries[0].name
    : i18n.t('liveActivity.models', { count: entries.length });

const currentProps = (): ModelDownloadActivityProps | undefined => {
  const entries = [...downloads.values()];
  if (entries.length === 0) {
    return undefined;
  }
  const progress = combinedProgress(entries);
  const waiting = entries.every(entry => entry.status === 'waiting');

  return {
    title: titleFor(entries),
    subtitle: waiting
      ? i18n.t('liveActivity.waiting')
      : i18n.t('liveActivity.downloading'),
    progress,
    percent: formatPercent(progress),
    icon: waiting ? 'pause.circle.fill' : 'arrow.down.circle.fill',
  };
};

const isSameShown = (
  a: ModelDownloadActivityProps | undefined,
  b: ModelDownloadActivityProps,
) =>
  a !== undefined &&
  a.title === b.title &&
  a.subtitle === b.subtitle &&
  a.percent === b.percent &&
  a.icon === b.icon;

// Adopts an activity left by an earlier run of the app (it outlives the
// process), ending any extra one.
const adoptExisting = (
  activityFactory: LiveActivityFactory<ModelDownloadActivityProps>,
) => {
  if (activity) {
    return;
  }
  const [first, ...rest] = activityFactory.getInstances();
  activity = first;
  rest.forEach(extra => enqueue(() => extra.end('immediate')));
};

const push = () => {
  pendingTimer = undefined;
  const props = currentProps();
  const activityFactory = getFactory();
  if (!props || !activityFactory) {
    return;
  }
  lastPushAt = Date.now();
  lastProps = props;

  try {
    adoptExisting(activityFactory);
    if (activity) {
      const current = activity;
      enqueue(() => current.update(props));
    } else {
      // Starting needs the app in the foreground; a refused start is tried
      // again on the next progress report.
      activity = activityFactory.start(props);
    }
  } catch (error) {
    log('downloadActivity push', error);
  }
};

const schedule = () => {
  const props = currentProps();
  if (!props || isSameShown(lastProps, props) || pendingTimer) {
    return;
  }
  const wait = lastPushAt + MIN_UPDATE_INTERVAL_MS - Date.now();
  if (wait <= 0) {
    push();
  } else {
    pendingTimer = setTimeout(push, wait);
  }
};

// Reports a model download's progress (0..1).
export const reportDownloadActivity = (
  modelId: number,
  {
    name,
    progress,
    sizeGB,
    status = 'downloading',
  }: {
    name: string;
    progress: number;
    sizeGB: number;
    status?: DownloadStatus;
  },
) => {
  if (!getFactory()) {
    return;
  }
  downloads.set(modelId, { name, progress, sizeGB, status });
  schedule();
};

// The download of a model ended. The activity ends with the last one: shown as
// done for a while when it finished, removed at once otherwise.
export const finishDownloadActivity = (
  modelId: number,
  outcome: DownloadActivityOutcome,
) => {
  const finished = downloads.get(modelId);
  if (!finished || !downloads.delete(modelId)) {
    return;
  }

  if (downloads.size > 0) {
    schedule();
    return;
  }

  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
  }
  const ending = activity;
  activity = undefined;
  lastProps = undefined;
  if (!ending) {
    return;
  }

  if (outcome !== 'downloaded') {
    enqueue(() => ending.end('immediate'));
    return;
  }

  const icon: ModelDownloadActivityIcon = 'checkmark.circle.fill';
  const { after } = require('expo-widgets') as typeof import('expo-widgets');
  enqueue(() =>
    ending.end(after(new Date(Date.now() + DONE_DISMISS_AFTER_MS)), {
      title: finished.name,
      subtitle: i18n.t('liveActivity.downloaded'),
      progress: 1,
      percent: formatPercent(1),
      icon,
    }),
  );
};

// Ends activities no download backs any more — one left on the Lock Screen by
// an app that was killed mid-download and whose download is gone.
export const endOrphanDownloadActivities = () => {
  const activityFactory = getFactory();
  if (!activityFactory || downloads.size > 0) {
    return;
  }
  try {
    const instances = activityFactory.getInstances();
    activity = undefined;
    lastProps = undefined;
    instances.forEach(instance => enqueue(() => instance.end('immediate')));
  } catch (error) {
    log('downloadActivity endOrphans', error);
  }
};
