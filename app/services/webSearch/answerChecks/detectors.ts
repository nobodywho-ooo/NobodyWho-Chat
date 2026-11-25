import type { WebIntentKind } from '../intentKind';
import { DATE_IN_TEXT } from '../passageSignals';
import {
  extractQueryTerms,
  foldForMatching,
  stemPrefix,
} from '../text/queryTerms';
import { detectQuestionLanguage } from '../text/questionLanguage';

import {
  answerStatesFigure,
  contextOffersFigureFor,
  distinctiveEvidence,
  leadSentence,
  visibleAnswer,
  withoutCodes,
  withoutSourceMarkers,
  YEAR_TOKEN,
} from './evidence';

const MIN_LANGUAGE_EVIDENCE = 2;

export const isWrongLanguageAnswer = (
  answer: string,
  question: string | undefined,
): boolean => {
  if (!question) {
    return false;
  }

  const expected = detectQuestionLanguage(question);

  if (!expected) {
    return false;
  }

  const visible = visibleAnswer(answer);

  if (!visible) {
    return false;
  }

  const actual = detectQuestionLanguage(visible);

  if (!actual || actual.code === expected.code) {
    return false;
  }

  if (actual.script && expected.script && actual.script !== expected.script) {
    return true;
  }

  return (actual.evidence ?? 0) >= MIN_LANGUAGE_EVIDENCE;
};

const QUESTION_WANTS_DATE =
  /\bwhen\b|\bwann\b|\bquand\b|\bcu[aá]ndo\b|\bquando\b|когда|कब/i;
const QUESTION_WANTS_AMOUNT =
  /\bhow (?:much|many)\b|\bprice\b|\bcost\b|\brate\b|\bpopulation\b|сколько|कितन/i;

const DAY_AND_MONTH =
  /\b\d{1,2}\s?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const CONTEXT_AMOUNT =
  /\d{1,3}(?:[.,   ]\d{3})+|\d+[.,]\d+|\p{Sc}\s?\d+|\d{2,}\s?(?:\p{Sc}|\p{L}{1,3}(?!\p{L}))/u;
const CONTEXT_SPEC_FIGURE = /\d{2,}\s?\p{L}/u;

const statesDate = (text: string): boolean =>
  DATE_IN_TEXT.test(text) || DAY_AND_MONTH.test(text);

const DATE_INTENTS: ReadonlySet<WebIntentKind> = new Set(['date', 'event']);
const AMOUNT_INTENTS: ReadonlySet<WebIntentKind> = new Set(['price', 'specs']);
const FIGURE_LEAD_INTENTS: ReadonlySet<WebIntentKind> = new Set([
  'fact',
  'price',
  'specs',
]);

export const claimsMissingEvidenceItHas = (
  answer: string,
  question: string | undefined,
  context: string,
  intent?: WebIntentKind,
): boolean => {
  if (!question || !context.trim()) {
    return false;
  }

  const visible = visibleAnswer(answer);

  if (!visible) {
    return false;
  }

  const evidence = withoutCodes(withoutSourceMarkers(context)).replace(
    YEAR_TOKEN,
    ' ',
  );
  const wantsDate =
    (!!intent && DATE_INTENTS.has(intent)) ||
    QUESTION_WANTS_DATE.test(question);

  if (wantsDate && statesDate(evidence)) {
    return !statesDate(visible) && !answerStatesFigure(visible, question);
  }

  const wantsAmount =
    (!!intent && AMOUNT_INTENTS.has(intent)) ||
    QUESTION_WANTS_AMOUNT.test(question);
  const contextStatesAmount =
    CONTEXT_AMOUNT.test(evidence) ||
    (intent === 'specs' && CONTEXT_SPEC_FIGURE.test(evidence));

  return (
    wantsAmount && contextStatesAmount && !answerStatesFigure(visible, question)
  );
};

const EVIDENCE_MIN_TOKENS = 5;
const EVIDENCE_MIN_ANSWER_CHARS = 40;

const contentStems = (text: string): Set<string> =>
  new Set(
    [...extractQueryTerms(text)].map(term => stemPrefix(foldForMatching(term))),
  );

const sharesWording = (
  answer: string,
  context: string,
  question: string | undefined,
): boolean => {
  const offered = contentStems(withoutSourceMarkers(context));

  for (const stem of contentStems(question ?? '')) {
    offered.delete(stem);
  }

  if (offered.size === 0) {
    return true;
  }

  for (const stem of contentStems(answer)) {
    if (offered.has(stem)) {
      return true;
    }
  }

  return false;
};

export const answerUsesNoRetrievedEvidence = (
  answer: string,
  question: string | undefined,
  context: string,
): boolean => {
  const visible = visibleAnswer(answer);

  if (visible.length < EVIDENCE_MIN_ANSWER_CHARS) {
    return false;
  }

  const offered = distinctiveEvidence(withoutSourceMarkers(context));

  for (const term of distinctiveEvidence(question ?? '')) {
    offered.delete(term);
  }

  if (offered.size < EVIDENCE_MIN_TOKENS) {
    return false;
  }

  const carried = distinctiveEvidence(visible);

  if (carried.size === 0) {
    return !sharesWording(visible, context, question);
  }

  for (const term of carried) {
    if (offered.has(term)) {
      return false;
    }
  }

  return true;
};

export const buriesFigureContextOffers = (
  answer: string,
  question: string | undefined,
  context: string,
  intent?: WebIntentKind,
): boolean =>
  !!intent &&
  FIGURE_LEAD_INTENTS.has(intent) &&
  contextOffersFigureFor(question, context) &&
  !answerStatesFigure(leadSentence(answer), question);

const DETAIL_FIGURE = /(?<![\p{L}\p{N}])\d(?:[\d.,:]*\d)?(?![\p{L}\p{N}])/gu;
const RETRY_LENGTH_FLOOR = 0.6;

const detailFigures = (text: string): Set<string> =>
  new Set([...text.matchAll(DETAIL_FIGURE)].map(match => match[0]));

export const retryDropsGroundedDetail = (
  original: string,
  retried: string,
): boolean => {
  const before = visibleAnswer(original);
  const after = visibleAnswer(retried);

  if (!before || !after) {
    return false;
  }

  const had = detailFigures(before);

  if (had.size === 0) {
    return false;
  }

  if ([...had].some(figure => after.includes(figure))) {
    return false;
  }

  return after.length < before.length * RETRY_LENGTH_FLOOR;
};
