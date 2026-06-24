const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

export interface ParsedThinking {
  thinking: string | null;
  rest: string;
  isThinkingComplete: boolean;
}

export const parseThinking = (content: string): ParsedThinking => {
  const leading = content.trimStart();
  if (!leading.startsWith(THINK_OPEN)) {
    return { thinking: null, rest: content, isThinkingComplete: true };
  }

  const afterOpen = leading.slice(THINK_OPEN.length);
  const closeIndex = afterOpen.indexOf(THINK_CLOSE);

  if (closeIndex === -1) {
    return {
      thinking: afterOpen.trimStart(),
      rest: '',
      isThinkingComplete: false,
    };
  }

  return {
    thinking: afterOpen.slice(0, closeIndex).trim(),
    rest: afterOpen.slice(closeIndex + THINK_CLOSE.length).trimStart(),
    isThinkingComplete: true,
  };
};

export const stripThinkingBlocks = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .trim();
