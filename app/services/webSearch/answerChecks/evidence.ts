import { stripThinkingBlocks } from 'helpers';

import { isCurrencyWord } from '../figureGrounding';
import { containsNeedle } from '../passageSignals';
import { toAsciiDigits } from '../text/asciiDigits';
import {
  extractQueryTerms,
  foldForMatching,
  stemPrefix,
} from '../text/queryTerms';
import { detectQuestionLanguage } from '../text/questionLanguage';

export const visibleAnswer = (answer: string): string =>
  stripThinkingBlocks(answer);

export const SOURCE_MARKER_LINE =
  /^[ \t]*--- (?:End of )?Source \d+.*?---[ \t]*$/gmu;
const SOURCE_TITLE_LINE = /^[ \t]*--- Source \d+: (.*?) ---[ \t]*$/gmu;

export const withoutSourceMarkers = (context: string): string =>
  context.replace(SOURCE_MARKER_LINE, '');

const NUMBER_RUN = /\d[\d.,:]*/g;
const NAME_RUN = /\p{Lu}[\p{L}\p{N}-]{2,}/gu;
const GROUPED_FIGURE = /^\d{1,3}(?:[.,:]\d{2,3})+$/;
const SENTENCE_OPENING = /(?:^|[.!?…:\n])[\s"'„«»()[\]—–-]*$/u;

const separatorFreeFigure = (value: string): string | null =>
  GROUPED_FIGURE.test(value) ? value.replace(/[.,:]/g, '') : null;

const opensSentence = (text: string, at: number): boolean =>
  SENTENCE_OPENING.test(text.slice(Math.max(0, at - 24), at));

const numericEvidence = (text: string): Set<string> => {
  const found = new Set<string>();
  for (const match of toAsciiDigits(text).match(NUMBER_RUN) ?? []) {
    const value = match.replace(/[.,:]+$/, '');

    if (value.length < 2) {
      continue;
    }

    found.add(value);
    const grouped = separatorFreeFigure(value);

    if (grouped) {
      found.add(grouped);
    }
  }

  return found;
};

export const distinctiveEvidence = (text: string): Set<string> => {
  const found = numericEvidence(text);

  for (const match of text.matchAll(NAME_RUN)) {
    if (opensSentence(text, match.index ?? 0)) {
      continue;
    }

    found.add(foldForMatching(match[0]));
  }

  return found;
};

export const YEAR_TOKEN = /(?<![\p{N}])(?:19|20)\d{2}(?![\p{N}])/gu;
const MIXED_TOKEN =
  /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}-]*\p{L})(?=[\p{L}\p{N}-]*\p{N})[\p{L}\p{N}-]+/gu;
const NUMBER_WITH_UNIT = /^\p{N}[\p{N}.,]*\p{L}+$/u;
const IDENTIFIER_RUN = /^\d{8,}$/;

export const withoutCodes = (text: string): string =>
  text.replace(MIXED_TOKEN, token =>
    NUMBER_WITH_UNIT.test(token) ? token : ' ',
  );

const figuresStated = (text: string): Set<string> =>
  new Set(
    (
      withoutCodes(toAsciiDigits(text))
        .replace(YEAR_TOKEN, ' ')
        .match(NUMBER_RUN) ?? []
    )
      .map(run => run.replace(/[.,]+$/, ''))
      .filter(run => !IDENTIFIER_RUN.test(run)),
  );

export const answerStatesFigure = (
  visible: string,
  question: string = '',
): boolean => {
  const asked = figuresStated(question);

  for (const figure of figuresStated(visible)) {
    if (!asked.has(figure)) {
      return true;
    }
  }

  return false;
};

export const questionStems = (question: string): string[] => [
  ...new Set(
    [...extractQueryTerms(question, detectQuestionLanguage(question)?.code)]
      .filter(term => !isCurrencyWord(term))
      .map(term => stemPrefix(foldForMatching(term))),
  ),
];

const SENTENCE_BREAK = /(?<=[.!?…])\s+|\n+/u;

export const leadSentence = (answer: string): string =>
  visibleAnswer(answer)
    .split(SENTENCE_BREAK)
    .find(sentence => sentence.trim()) ?? '';

const EVIDENCE_LINES_MAX = 3;
const EVIDENCE_LINE_MAX_CHARS = 200;
const EVIDENCE_WINDOW_WORDS = 12;
const EVIDENCE_WINDOW_PADDING = 3;
const TOPIC_STEM_DISCOUNT = 0.5;
const BARE_DIGIT_DISCOUNT = 0.25;
const QUESTION_SENTENCE = /\?\s*$/u;
const MEASUREMENT_FIGURE = /\p{N}{2,}|\p{N}\s?(?:[°%]|\p{Sc})/u;

const figureQuality = (words: string[], at: number): number =>
  at !== -1 &&
  MEASUREMENT_FIGURE.test(toAsciiDigits(words.slice(at, at + 2).join(' ')))
    ? 1
    : BARE_DIGIT_DISCOUNT;

const stemWeights = (
  sentences: string[],
  stems: string[],
): Map<string, number> => {
  const folded = sentences.map(foldForMatching);

  return new Map(
    stems.map(stem => {
      const hits = folded.filter(sentence =>
        containsNeedle(sentence, stem),
      ).length;

      return [stem, hits === 0 ? 0 : Math.log((sentences.length + 1) / hits)];
    }),
  );
};

const topicStemsOf = (context: string, stems: string[]): Set<string> => {
  const titles = [...context.matchAll(SOURCE_TITLE_LINE)].map(match =>
    foldForMatching(match[1] ?? ''),
  );
  const topic = new Set(
    stems.filter(stem => titles.some(title => containsNeedle(title, stem))),
  );

  return topic.size === stems.length ? new Set() : topic;
};

interface EvidenceCandidate {
  words: string[];
  index: number;
  score: number;
  anchor: number;
  figure: number;
}

const nearestFigure = (figures: number[], at: number): number =>
  figures.reduce(
    (best, figure) =>
      best === -1 || Math.abs(figure - at) < Math.abs(best - at)
        ? figure
        : best,
    -1,
  );

const withinWindow = (figure: number, at: number): boolean =>
  figure !== -1 && Math.abs(figure - at) <= EVIDENCE_WINDOW_WORDS;

const locateEvidence = (
  sentence: string,
  index: number,
  stems: string[],
  topic: Set<string>,
  weights: Map<string, number>,
  question: string,
): EvidenceCandidate => {
  const words = sentence.split(/\s+/);
  const figures = words.flatMap((word, at) =>
    answerStatesFigure(word, question) ? [at] : [],
  );
  let score = 0;
  let anchor = -1;
  let anchorRank = -1;
  let figure = -1;
  let topicAnchor = -1;
  let topicRank = -1;

  for (const stem of stems) {
    const at = words.findIndex(word =>
      containsNeedle(foldForMatching(word), stem),
    );

    if (at === -1) {
      continue;
    }

    const weight = weights.get(stem) ?? 0;

    if (topic.has(stem)) {
      score += weight * TOPIC_STEM_DISCOUNT;

      if (weight > topicRank) {
        topicRank = weight;
        topicAnchor = at;
      }

      continue;
    }

    const near = nearestFigure(figures, at);
    const close = withinWindow(near, at);

    if (close) {
      score += weight;
    }

    const rank = weight + (close ? 1 : 0);

    if (rank > anchorRank) {
      anchorRank = rank;
      anchor = at;
      figure = close ? near : -1;
    }
  }

  if (anchor === -1) {
    anchor = Math.max(0, topicAnchor);
    const near = nearestFigure(figures, anchor);
    figure = withinWindow(near, anchor) ? near : -1;
  }

  const best = figure === -1 ? nearestFigure(figures, anchor) : figure;

  return {
    words,
    index,
    score: figures.length === 0 ? 0 : score * figureQuality(words, best),
    anchor,
    figure,
  };
};

const figureDistance = (candidate: EvidenceCandidate): number =>
  candidate.figure === -1
    ? Number.POSITIVE_INFINITY
    : Math.abs(candidate.figure - candidate.anchor);

const clipAroundStem = ({ words, anchor, figure }: EvidenceCandidate) => {
  const sentence = words.join(' ');

  if (sentence.length <= EVIDENCE_LINE_MAX_CHARS) {
    return sentence;
  }

  const span = figure === -1 ? [anchor, anchor] : [anchor, figure];
  const lo = Math.min(...span);
  const hi = Math.max(...span);

  return words
    .slice(
      Math.max(0, lo - EVIDENCE_WINDOW_PADDING),
      hi + EVIDENCE_WINDOW_PADDING + 1,
    )
    .join(' ');
};

export const evidenceLinesFor = (
  question: string | undefined,
  context: string,
): string[] => {
  const asked = question ?? '';
  const stems = questionStems(asked);

  if (stems.length === 0) {
    return [];
  }

  const topic = topicStemsOf(context, stems);
  const sentences = withoutSourceMarkers(context)
    .split(SENTENCE_BREAK)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && !QUESTION_SENTENCE.test(sentence));
  const weights = stemWeights(sentences, stems);
  const candidates = sentences
    .map((sentence, index) =>
      locateEvidence(sentence, index, stems, topic, weights, asked),
    )
    .filter(candidate => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        figureDistance(a) - figureDistance(b) ||
        a.index - b.index,
    );
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const line = clipAroundStem(candidate);
    const key = foldForMatching(line);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    lines.push(line);

    if (lines.length === EVIDENCE_LINES_MAX) {
      break;
    }
  }
  return lines;
};

export const contextOffersFigureFor = (
  question: string | undefined,
  context: string,
): boolean => evidenceLinesFor(question, context).length > 0;
