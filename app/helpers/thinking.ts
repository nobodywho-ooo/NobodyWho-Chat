const quoteLines = (text: string): string =>
  text
    .trim()
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');

export const formatThinkingBlocks = (text: string): string => {
  return text
    .replace(
      /<think>([\s\S]*?)<\/think>/g,
      (_match, content: string) => quoteLines(content) + '\n\n',
    )
    .replace(/<think>([\s\S]*)$/g, (_match, content: string) =>
      quoteLines(content),
    );
};

export const stripThinkingBlocks = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .trim();
