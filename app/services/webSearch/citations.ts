import type { WebSource } from 'types';

import { extractQueryTerms, stemPrefix } from './text/queryTerms';

export interface AttributedBlock {
  text: string;
  source: WebSource | null;
}

const CITATION_PATTERN = /(^|[^\w$)\]])\[\d{1,3}\]/g;
const SENTENCE_CHAR_OR_DECIMAL_POINT = '(?:[^.!?\\n]|[.!?](?=\\d))';
const SENTENCE_TERMINATOR = '[.!?]+(?!\\d)';
const CITATION_SENTENCE_PATTERN = new RegExp(
  `${SENTENCE_CHAR_OR_DECIMAL_POINT}*${SENTENCE_TERMINATOR}|\\n+|${SENTENCE_CHAR_OR_DECIMAL_POINT}+$`,
  'g',
);
const CITATION_MIN_MATCH_SCORE = 2;

const BRACKETED_SOURCE_NUMBER = /\[(\d{1,3})\]/g;
const SOURCE_BLOCK_LABEL =
  /(?<![\p{L}\p{N}])Source\s+(\d{1,3})(?![\p{L}\p{N}])/giu;

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const FENCE = /^\s*```/;
const HEADING = /^\s*#{1,6}\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

export const stripCitations = (text: string): string => {
  if (!text) {
    return text;
  }

  let stripped = text;
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(CITATION_PATTERN, '$1');
  } while (stripped !== previous);

  return stripped.replace(/ +([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ');
};

const citedSourceNumbersIn = (block: string): number[] => [
  ...[...block.matchAll(BRACKETED_SOURCE_NUMBER)].map(match =>
    Number(match[1]),
  ),
  ...[...block.matchAll(SOURCE_BLOCK_LABEL)].map(match => Number(match[1])),
];

const stemsOf = (text: string): Set<string> =>
  new Set([...extractQueryTerms(text)].map(stemPrefix));

const overlap = (haystack: Set<string>, needles: Set<string>): number => {
  let hits = 0;

  for (const stem of needles) {
    if (haystack.has(stem)) {
      hits += 1;
    }
  }

  return hits;
};

const isStructureLine = (line: string): boolean =>
  LIST_ITEM.test(line) || HEADING.test(line) || TABLE_ROW.test(line);

export const splitIntoBlocks = (text: string): string[] => {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;

  const flush = () => {
    const joined = current.join('\n').trim();

    if (joined) {
      blocks.push(joined);
    }

    current = [];
  };

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      if (fenced) {
        current.push(line);
        fenced = false;
        flush();
      } else {
        flush();
        fenced = true;
        current.push(line);
      }
      continue;
    }

    if (fenced) {
      current.push(line);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const startsStructure = isStructureLine(line);
    const inStructure = current.length > 0 && isStructureLine(current[0]!);

    if (startsStructure && current.length > 0 && !inStructure) {
      flush();
    }

    if (!startsStructure && inStructure) {
      flush();
    }

    current.push(line);
  }

  flush();

  return blocks;
};

const sentencesOf = (block: string): string[] => {
  const matched = block.match(CITATION_SENTENCE_PATTERN) ?? [block];

  return matched.map(sentence => sentence.trim()).filter(Boolean);
};

const bestSourceFor = (
  sentence: string,
  sourceStems: Set<string>[],
): number | null => {
  const stems = stemsOf(sentence);

  if (stems.size === 0) {
    return null;
  }

  let bestIndex: number | null = null;
  let bestScore = 0;
  sourceStems.forEach((haystack, index) => {
    const score = overlap(haystack, stems);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= CITATION_MIN_MATCH_SCORE ? bestIndex : null;
};

const mostVoted = (votes: Map<number, number>): number | null => {
  let winner: number | null = null;
  let best = 0;

  for (const [index, count] of votes) {
    if (count > best) {
      best = count;
      winner = index;
    }
  }

  return winner;
};

export const attributeSourcesByBlock = (
  visibleAnswer: string,
  sources: readonly WebSource[],
): AttributedBlock[] => {
  const visible = visibleAnswer.trim();
  if (!visible) {
    return [];
  }

  const usable = sources.filter(source => source.used !== false);
  const blocks = splitIntoBlocks(visible);

  if (usable.length === 0) {
    return blocks.map(text => ({ text, source: null }));
  }

  const indexBySourceNumber = new Map<number, number>();
  usable.forEach((source, index) => {
    if (
      source.sourceNumber !== undefined &&
      !indexBySourceNumber.has(source.sourceNumber)
    ) {
      indexBySourceNumber.set(source.sourceNumber, index);
    }
  });

  const namedSourceIn = (text: string): number | null => {
    const votes = new Map<number, number>();
    for (const sourceNumber of citedSourceNumbersIn(text)) {
      const index = indexBySourceNumber.get(sourceNumber);

      if (index === undefined) {
        continue;
      }

      votes.set(index, (votes.get(index) ?? 0) + 1);
    }
    return mostVoted(votes);
  };

  let sourceStems: Set<string>[] | null = null;

  const bestOverlapIn = (text: string): number | null => {
    sourceStems ??= usable.map(source =>
      stemsOf(`${source.name} ${source.passage ?? ''}`),
    );
    const stems = sourceStems;
    const votes = new Map<number, number>();

    for (const sentence of sentencesOf(text)) {
      const index = bestSourceFor(sentence, stems);

      if (index === null) {
        continue;
      }

      votes.set(index, (votes.get(index) ?? 0) + 1);
    }

    return mostVoted(votes);
  };

  let carried: number | null = null;
  const attributed = blocks.map(text => {
    let winner = namedSourceIn(text) ?? bestOverlapIn(text);

    if (winner === null) {
      winner = carried;
    } else {
      carried = winner;
    }

    return { text, index: winner };
  });

  const merged: AttributedBlock[] = [];

  for (const block of attributed) {
    const previous = merged.at(-1);
    const source = block.index === null ? null : usable[block.index]!;
    const text = stripCitations(block.text);

    if (previous && previous.source === source) {
      merged[merged.length - 1] = {
        text: `${previous.text}\n\n${text}`,
        source,
      };
      continue;
    }

    merged.push({ text, source });
  }

  return merged;
};
