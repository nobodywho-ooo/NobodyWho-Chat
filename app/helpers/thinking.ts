interface ThinkDelimiters {
  open: string;
  close: string;
}

// Different model families wrap their reasoning in different delimiters.
// Qwen-style models use <think>…</think>; Gemma-style models open a reasoning
// channel with <|channel>thought and close it with <channel|>. We support
// every known pair so reasoning is folded away instead of leaking into the
// rendered answer.
const THINK_DELIMITERS: ThinkDelimiters[] = [
  { open: '<think>', close: '</think>' },
  { open: '<|channel>thought', close: '<channel|>' },
];

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ParsedThinking {
  thinking: string | null;
  rest: string;
  isThinkingComplete: boolean;
}

export const stripThinkingBlocks = (text: string): string => {
  let result = text;
  for (const { open, close } of THINK_DELIMITERS) {
    const o = escapeRegExp(open);
    const c = escapeRegExp(close);
    result = result
      .replace(new RegExp(`${o}[\\s\\S]*?${c}`, 'g'), '')
      .replace(new RegExp(`${o}[\\s\\S]*$`, 'g'), '');
  }
  return result.trim();
};

export const parseThinking = (content: string): ParsedThinking => {
  const thoughts: string[] = [];

  // Every closed reasoning block is captured, regardless of which delimiter
  // family it uses. A tool-calling thinking model emits one block per tool
  // round, so a single turn can contain several — we can't assume just one
  // leading block (the leftovers used to leak into `rest` and render as raw
  // markdown).
  const closedPattern = THINK_DELIMITERS.map(
    ({ open, close }) =>
      `${escapeRegExp(open)}([\\s\\S]*?)${escapeRegExp(close)}`,
  ).join('|');
  const closedBlock = new RegExp(closedPattern, 'g');
  let match: RegExpExecArray | null;
  while ((match = closedBlock.exec(content)) !== null) {
    // Exactly one capture group per delimiter pair matches; the rest are
    // undefined.
    const thought = (match.slice(1).find(group => group !== undefined) ?? '').trim();
    if (thought) thoughts.push(thought);
  }

  // A trailing open tag with no closing tag is the block still streaming in.
  // Whichever delimiter opens latest wins, so mixed content resolves correctly.
  let lastOpenIndex = -1;
  let openDelim: ThinkDelimiters | null = null;
  for (const delim of THINK_DELIMITERS) {
    const index = content.lastIndexOf(delim.open);
    if (index > lastOpenIndex) {
      lastOpenIndex = index;
      openDelim = delim;
    }
  }

  const isThinkingComplete =
    openDelim === null ||
    content.indexOf(openDelim.close, lastOpenIndex + openDelim.open.length) !==
      -1;

  if (!isThinkingComplete && openDelim) {
    const partial = content.slice(lastOpenIndex + openDelim.open.length).trim();
    if (partial) thoughts.push(partial);
  }

  return {
    thinking: thoughts.length > 0 ? thoughts.join('\n\n') : null,
    rest: stripThinkingBlocks(content),
    isThinkingComplete,
  };
};
