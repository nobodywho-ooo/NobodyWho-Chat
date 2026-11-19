import { parseThinking } from 'helpers';

import type { QueryRewriteFn, QueryRewriteMessage } from './buildSearchQuery';
import { namedEntitiesIn } from './conversationSubject';
import { foldForMatching } from './text/queryTerms';

export const DIGEST_MAX_CHARS = 200;

const DIGEST_SYSTEM_PROMPT =
  'You track what a conversation is currently about, so a later follow-up ' +
  'question can be understood on its own. Given the previous topic (if any) ' +
  'and the latest exchange, write the updated topic as a short noun phrase ' +
  'of at most 12 words, in the same language as the conversation, naming ' +
  'the subject and any key entities (people, products, places) still ' +
  'relevant. It must read like a search phrase, not like a sentence about ' +
  'the user: write "moka pot coffee, grind size", never ' +
  '"The user is asking about...". Output ONLY that phrase — no labels, no ' +
  'quotes, no reasoning, no commentary.';

export const buildDigestPrompt = (
  previousDigest: string | null,
  question: string,
  answer: string,
): QueryRewriteMessage[] => [
  { role: 'system', content: DIGEST_SYSTEM_PROMPT },
  {
    role: 'user',
    content:
      `Previous topic: ${previousDigest?.trim() || 'none yet'}\n\n` +
      `Latest exchange:\nUser: ${question}\nAssistant: ${answer}\n\n` +
      'Updated topic:',
  },
];

const TOPIC_LABEL = /^\s*(?:updated\s+)?topic\s*:\s*/i;
const DIGEST_STOP_VISIBLE_CHARS = DIGEST_MAX_CHARS * 2;
export const DIGEST_STOP_RAW_CHARS = 1500;

const topicOf = (line: string): string => line.replace(TOPIC_LABEL, '').trim();

export const firstTopicLine = (text: string): string =>
  text.split('\n').map(topicOf).find(Boolean) ?? '';

const THINK_CLOSERS = ['</think>', '<channel|>', '[/THINK]'];

const answerPart = (raw: string): string => {
  if (parseThinking(raw).thinking === null) {
    return raw;
  }

  const end = Math.max(
    ...THINK_CLOSERS.map(closer => {
      const at = raw.lastIndexOf(closer);
      return at === -1 ? -1 : at + closer.length;
    }),
  );

  return end === -1 ? '' : raw.slice(end);
};

const hasUnclosedThink = (raw: string): boolean => {
  const { thinking, isThinkingComplete } = parseThinking(raw);

  return thinking !== null && !isThinkingComplete;
};

export const digestReplyIsComplete = (raw: string): boolean => {
  if (raw.length >= DIGEST_STOP_RAW_CHARS) {
    return true;
  }

  if (hasUnclosedThink(raw)) {
    return false;
  }

  const visible = answerPart(raw);

  if (visible.length >= DIGEST_STOP_VISIBLE_CHARS) {
    return true;
  }

  return visible
    .split('\n')
    .slice(0, -1)
    .some(line => !!topicOf(line));
};

const ECHO_LEAD_WORDS = 8;
const ECHO_COVERAGE_RATIO = 0.6;

export const visibleDigestText = (raw: string): string => {
  const { thinking, rest, isThinkingComplete } = parseThinking(raw);

  if (rest) {
    return rest;
  }

  if (thinking !== null && !isThinkingComplete) {
    const unterminated = thinking.trim();
    if (unterminated.length <= DIGEST_MAX_CHARS) {
      return unterminated;
    }
  }

  return '';
};

const normalizeForEcho = (text: string): string =>
  foldForMatching(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const looksLikeAnswerEcho = (
  digest: string,
  answer: string,
): boolean => {
  const summary = normalizeForEcho(digest);
  const source = normalizeForEcho(parseThinking(answer).rest);

  if (!summary || !source) {
    return false;
  }

  if (
    source.includes(summary) &&
    summary.length / source.length >= ECHO_COVERAGE_RATIO
  ) {
    return true;
  }

  const summaryWords = summary.split(' ');

  if (summaryWords.length < ECHO_LEAD_WORDS) {
    return false;
  }

  return (
    summaryWords.slice(0, ECHO_LEAD_WORDS).join(' ') ===
    source.split(' ').slice(0, ECHO_LEAD_WORDS).join(' ')
  );
};

const PROMPT_ECHO_MIN_WORDS = 2;

export const looksLikePromptEcho = (digest: string): boolean => {
  const summary = normalizeForEcho(digest);

  if (summary.split(' ').filter(Boolean).length < PROMPT_ECHO_MIN_WORDS) {
    return false;
  }

  return normalizeForEcho(DIGEST_SYSTEM_PROMPT).includes(summary);
};

const META_FRAME =
  /^\s*(?:the\s+)?(?:user|conversation|discussion|topic|assistant)\b[^.:]{0,60}?\b(?:is|was|are|about|asking|asks|wants|asked|discussing)\b[^.:]{0,30}?(?:about|is|:)\s*/i;
const META_TAIL = /\s*(?:the\s+)?key entities?\b[^.]*\.?\s*$/i;

export const stripMetaFrame = (text: string): string => {
  const withoutTail = text.replace(META_TAIL, '').trim() || text.trim();
  const cleaned = withoutTail.replace(META_FRAME, '').trim() || withoutTail;

  return cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim() || text.trim();
};

const keepsMoreSubject = (
  previousDigest: string | null,
  fallback: string,
): boolean =>
  !!previousDigest?.trim() &&
  namedEntitiesIn(fallback).length === 0 &&
  namedEntitiesIn(previousDigest).length > 0;

const clampDigest = (text: string): string =>
  text.length <= DIGEST_MAX_CHARS
    ? text
    : `${text.slice(0, DIGEST_MAX_CHARS).trimEnd()}…`;

export const updateConversationDigest = async (
  generate: QueryRewriteFn,
  previousDigest: string | null,
  question: string,
  answer: string,
): Promise<string> => {
  if (!question.trim() || !answer.trim()) {
    return previousDigest ?? '';
  }

  try {
    const raw = await generate(
      buildDigestPrompt(previousDigest, question, answer),
    );
    const trimmed = firstTopicLine(visibleDigestText(raw));

    if (!trimmed) {
      return previousDigest ?? '';
    }

    const summary = clampDigest(stripMetaFrame(trimmed));

    if (
      !looksLikeAnswerEcho(trimmed, answer) &&
      !looksLikePromptEcho(summary)
    ) {
      return summary;
    }

    const fallback = clampDigest(question.trim());

    return keepsMoreSubject(previousDigest, fallback)
      ? previousDigest!
      : fallback;
  } catch {
    return previousDigest ?? '';
  }
};
