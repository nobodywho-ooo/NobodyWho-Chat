const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

export interface ParsedThinking {
  thinking: string | null;
  rest: string;
  isThinkingComplete: boolean;
}

export const stripThinkingBlocks = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .trim();

export const parseThinking = (content: string): ParsedThinking => {
  const thoughts: string[] = [];

  // Every closed <think>…</think> block is reasoning. A tool-calling thinking
  // model emits one block per tool round, so a single turn can contain several
  // — we can't assume just one leading block (the leftovers used to leak into
  // `rest` and render as raw markdown).
  const closedBlock = /<think>([\s\S]*?)<\/think>/g;
  let match: RegExpExecArray | null;
  while ((match = closedBlock.exec(content)) !== null) {
    const thought = match[1].trim();
    if (thought) thoughts.push(thought);
  }

  // A trailing <think> with no closing tag is the block still streaming in.
  const openIndex = content.lastIndexOf(THINK_OPEN);
  const isThinkingComplete =
    openIndex === -1 ||
    content.indexOf(THINK_CLOSE, openIndex + THINK_OPEN.length) !== -1;

  if (!isThinkingComplete) {
    const partial = content.slice(openIndex + THINK_OPEN.length).trim();
    if (partial) thoughts.push(partial);
  }

  return {
    thinking: thoughts.length > 0 ? thoughts.join('\n\n') : null,
    rest: stripThinkingBlocks(content),
    isThinkingComplete,
  };
};
