import { Model } from 'types';

interface ThinkDelimiters {
  open: string;
  close: string;
}

const THINK_TAGS: ThinkDelimiters = { open: '<think>', close: '</think>' };
const THOUGHT_CHANNEL: ThinkDelimiters = {
  open: '<|channel>thought',
  close: '<channel|>',
};
const THINK_BRACKETS: ThinkDelimiters = { open: '[THINK]', close: '[/THINK]' };

const THINK_DELIMITERS: ThinkDelimiters[] = [
  THINK_TAGS,
  THOUGHT_CHANNEL,
  THINK_BRACKETS,
];

// Where a chat template prefills the opening delimiter into the *prompt*: at
// the start of an assistant turn, and/or where generation resumes after a tool
// result. From such a point the model only ever emits the closing delimiter —
// the opening one was already spent, upstream of the token stream.
export type ThinkPrefillSite = 'turn' | 'toolResult';

export interface ImplicitThinkOpen {
  family: string;
  delimiters: ThinkDelimiters;
  sites: ThinkPrefillSite[];
}

// Read off each model's own chat template, at its `add_generation_prompt`
// branch. Missing entries are not a correctness problem, only a latency one:
// parseThinking folds an unmatched closing delimiter anyway (see scanThinking),
// it just cannot do so until that delimiter arrives.
const IMPLICIT_THINK_OPEN: ImplicitThinkOpen[] = [
  {
    family: 'LFM2.5',
    delimiters: THINK_TAGS,
    sites: ['turn', 'toolResult'],
  },
  {
    family: 'MiniCPM5',
    delimiters: THINK_TAGS,
    sites: ['turn', 'toolResult'],
  },
  {
    family: 'G9v3',
    delimiters: THINK_TAGS,
    sites: ['turn', 'toolResult'],
  },
  {
    family: 'NeoHorse 1',
    delimiters: THINK_TAGS,
    sites: ['turn', 'toolResult'],
  },
  {
    family: 'Gemma 4',
    delimiters: THOUGHT_CHANNEL,
    sites: ['toolResult'],
  },
];

export const implicitThinkOpen = (
  model: Model,
  thinkingEnabled: boolean,
): ImplicitThinkOpen | undefined => {
  if (!thinkingEnabled) {
    return undefined;
  }

  const family = model.family.toLowerCase();

  return IMPLICIT_THINK_OPEN.find(spec => spec.family.toLowerCase() === family);
};

export interface ThinkOpenWriter {
  write: (site: ThinkPrefillSite, content: string) => string; // Returns the content with the opening delimiter
}

export const createThinkOpenWriter = (
  implicit: ImplicitThinkOpen | undefined,
): ThinkOpenWriter => {
  if (implicit === undefined) {
    return { write: (_site, content) => content };
  }

  return {
    write: (site, content) =>
      implicit.sites.includes(site)
        ? content + implicit.delimiters.open
        : content,
  };
};

export interface ParsedThinking {
  thinking: string | null;
  rest: string;
  isThinkingComplete: boolean;
}

interface ScannedThinking {
  thoughts: string[];
  answer: string;
  isComplete: boolean;
}

// A block's body can start with the very delimiter that opened it, when an
// opener written back (createThinkOpenWriter) meets a model that emitted one of
// its own anyway. Skip the repeat so a stray tag is not shown as the first line
// of the reasoning.
//
// The content itself bounds the walk: no delimiter is empty, so every pass that
// does not return advances `at` by at least one character.
const skipRepeatedOpen = (
  content: string,
  from: number,
  open: string,
): number => {
  let at = from;

  while (at < content.length) {
    const tail = content.slice(at);
    const lead = tail.length - tail.trimStart().length;

    if (!content.startsWith(open, at + lead)) {
      return at;
    }

    at += lead + open.length;
  }

  // Nothing but whitespace and repeated openers to the end: an open block with
  // no reasoning in it yet.
  return at;
};

// Walks the content once, left to right, splitting it into reasoning blocks and
// answer text.
//
// Scanning rather than replacing pattern by pattern is what keeps the delimiter
// families from interfering: only the pair that actually opened a block is
// looked for while inside it, so a `[/THINK]` quoted inside a `<think>` block
// is plain text and not a stray terminator.
//
// A closing delimiter reached with no block open is treated as a block whose
// opening delimiter the chat template spent in the prompt (see
// IMPLICIT_THINK_OPEN). That rule applies to every family and to stored
// messages too, which is what makes history stored before this writer existed —
// and any closing-only model not yet in the table — render correctly. The
// cost is that a model quoting a bare closing delimiter in prose has the text
// before it filed as reasoning; that text stays readable in the thinking block,
// whereas the reverse mistake buries a whole answer.
const scanThinking = (content: string): ScannedThinking => {
  const thoughts: string[] = [];
  let answer = '';
  let index = 0;

  const pushThought = (thought: string) => {
    const trimmed = thought.trim();
    if (trimmed) {
      thoughts.push(trimmed);
    }
  };

  while (index < content.length) {
    let openAt = -1;
    let opened: ThinkDelimiters | undefined;
    let closeAt = -1;
    let closed: ThinkDelimiters | undefined;

    for (const delimiters of THINK_DELIMITERS) {
      const at = content.indexOf(delimiters.open, index);
      if (at !== -1 && (openAt === -1 || at < openAt)) {
        openAt = at;
        opened = delimiters;
      }

      const to = content.indexOf(delimiters.close, index);
      if (to !== -1 && (closeAt === -1 || to < closeAt)) {
        closeAt = to;
        closed = delimiters;
      }
    }

    // An unmatched closing delimiter: the block started where the previous one
    // ended (or at the start of the message).
    if (closed !== undefined && (opened === undefined || closeAt < openAt)) {
      pushThought(content.slice(index, closeAt));
      index = closeAt + closed.close.length;
      continue;
    }

    // No delimiter ahead at all — the remainder is answer text.
    if (opened === undefined) {
      answer += content.slice(index);
      break;
    }

    answer += content.slice(index, openAt);

    const bodyAt = skipRepeatedOpen(
      content,
      openAt + opened.open.length,
      opened.open,
    );
    const endsAt = content.indexOf(opened.close, bodyAt);

    if (endsAt === -1) {
      pushThought(content.slice(bodyAt));
      return { thoughts, answer, isComplete: false };
    }

    pushThought(content.slice(bodyAt, endsAt));
    index = endsAt + opened.close.length;
  }

  return { thoughts, answer, isComplete: true };
};

export const stripThinkingBlocks = (text: string): string =>
  scanThinking(text).answer.trim();

export const parseThinking = (content: string): ParsedThinking => {
  // A tool-calling thinking model emits one block per tool round, so a single
  // turn can contain several — they are joined rather than assumed to be one
  // leading block (the leftovers used to leak into `rest` as raw markdown).
  const { thoughts, answer, isComplete } = scanThinking(content);

  return {
    thinking: thoughts.length > 0 ? thoughts.join('\n\n') : null,
    rest: answer.trim(),
    isThinkingComplete: isComplete,
  };
};

// True when a turn produced something worth keeping: reasoning, an answer, or
// both. A turn stopped before its first token leaves only the opening delimiter
// createThinkOpenWriter wrote, which is a tag rather than a message — storing it
// would put an empty bubble in the conversation.
export const hasMessageContent = (content: string): boolean => {
  const { thinking, rest } = parseThinking(content);
  return thinking !== null || rest !== '';
};
