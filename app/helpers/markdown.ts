import { MarkdownStyle } from 'react-native-enriched-markdown';

export const getMarkdownStyle = (
  isDarkMode: boolean,
  color: string,
): MarkdownStyle => {
  if (!isDarkMode) return {};

  return {
    h1: { color },
    h2: { color },
    h3: { color },
    paragraph: { color },
    strong: { color },
    em: { color },
    strikethrough: { color },
    underline: { color },
    link: { color },
    code: { color, backgroundColor: '#1E1E1E' },
    codeBlock: { color },
    blockquote: { color, backgroundColor: '#1E1E1E' },
    list: { color },
    math: { color },
    inlineMath: { color },
  };
};
