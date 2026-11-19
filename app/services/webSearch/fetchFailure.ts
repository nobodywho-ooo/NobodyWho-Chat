import { type TFunction } from 'i18next';

import { FetchStatusError } from './security/outboundFetch';

export type FetchFailureReason =
  | 'blocked'
  | 'not-found'
  | 'server-error'
  | 'timeout'
  | 'unsupported'
  | 'too-large'
  | 'empty'
  | 'network'
  | 'aborted';

export interface FetchFailure {
  url: string;
  host: string;
  reason: FetchFailureReason;
}

const STATUS_MESSAGE = /^Fetch failed: (\d{3})(?:\s|$)/;

const BLOCKING_STATUSES = new Set([401, 402, 403, 407, 423, 429, 451]);
const MISSING_STATUSES = new Set([404, 410]);

const statusReason = (status: number): FetchFailureReason => {
  if (BLOCKING_STATUSES.has(status)) {
    return 'blocked';
  }

  if (MISSING_STATUSES.has(status)) {
    return 'not-found';
  }

  if (status >= 500) {
    return 'server-error';
  }

  return 'network';
};

export const classifyFetchError = (error: unknown): FetchFailureReason => {
  if (error instanceof FetchStatusError) {
    return statusReason(error.status);
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/aborted/i.test(message)) {
    return 'aborted';
  }
  if (/timed out/i.test(message)) {
    return 'timeout';
  }
  if (/unsupported content type|binary body/i.test(message)) {
    return 'unsupported';
  }
  if (/too large/i.test(message)) {
    return 'too-large';
  }
  if (/refusing (?:to fetch|redirect)/i.test(message)) {
    return 'blocked';
  }

  const status = Number(message.match(STATUS_MESSAGE)?.[1]);

  return Number.isFinite(status) ? statusReason(status) : 'network';
};

export const classifyUnusableContent = (
  isBotWall: boolean,
): FetchFailureReason => (isBotWall ? 'blocked' : 'empty');

const HOST_LEVEL_REASONS = new Set<FetchFailureReason>([
  'blocked',
  'server-error',
]);

export const isHostLevelFailure = (reason: FetchFailureReason): boolean =>
  HOST_LEVEL_REASONS.has(reason);

const RETRYABLE_REASONS = new Set<FetchFailureReason>([
  'blocked',
  'not-found',
  'server-error',
  'timeout',
  'unsupported',
  'too-large',
  'empty',
  'network',
]);

export const isRecoverableFailure = (reason: FetchFailureReason): boolean =>
  RETRYABLE_REASONS.has(reason);

const REASON_KEYS: Record<FetchFailureReason, string> = {
  blocked: 'blocked',
  'not-found': 'notFound',
  'server-error': 'serverError',
  timeout: 'timeout',
  unsupported: 'unsupported',
  'too-large': 'tooLarge',
  empty: 'empty',
  network: 'network',
  aborted: 'aborted',
};

export const describeFetchFailure = (
  reason: FetchFailureReason,
  t: TFunction,
): string =>
  t(
    `components.messageListItem.searchTrace.fetchFailure.${REASON_KEYS[reason]}`,
  );

export const summarizeFetchFailures = (
  failures: FetchFailure[],
  t: TFunction,
): string => {
  const recoverable = failures.filter(failure =>
    isRecoverableFailure(failure.reason),
  );

  if (recoverable.length === 0) {
    return '';
  }

  const counts = new Map<FetchFailureReason, number>();

  for (const failure of recoverable) {
    counts.set(failure.reason, (counts.get(failure.reason) ?? 0) + 1);
  }

  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;

  return t('components.messageListItem.searchTrace.failures', {
    count: recoverable.length,
    reason: describeFetchFailure(dominant[0], t),
  });
};
