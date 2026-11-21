import type { Encoder } from 'react-native-nobodywho';

import { truncateToTokenBudget } from './text/textChunking';

export interface WebEmbeddings {
  runWithLoadedModel<T>(operation: () => Promise<T>): Promise<T>;
  embedQuery(text: string): Promise<number[]>;
  embedDocument(text: string): Promise<number[]>;
}

export interface EmbeddingPrefixes {
  query: string;
  document: string;
}

const NO_PREFIXES: EmbeddingPrefixes = { query: '', document: '' };

const PREFIXES_BY_FAMILY: [string, EmbeddingPrefixes][] = [
  [
    'embeddinggemma',
    {
      query: 'task: search result | query: ',
      document: 'title: none | text: ',
    },
  ],
  ['nomic', { query: 'search_query: ', document: 'search_document: ' }],
  ['e5', { query: 'query: ', document: 'passage: ' }],
  [
    'qwen3-embedding',
    {
      query:
        'Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ',
      document: '',
    },
  ],
  ['lfm', { query: 'query: ', document: 'document: ' }],
];

export const embeddingPrefixesFor = (family: string): EmbeddingPrefixes => {
  const key = family.toLowerCase();

  return (
    PREFIXES_BY_FAMILY.find(([needle]) => key.includes(needle))?.[1] ??
    NO_PREFIXES
  );
};

interface EncoderEmbeddingsOptions {
  load: () => Promise<boolean>;
  release: () => void;
  borrow: <R>(work: (encoder: Encoder) => Promise<R>) => Promise<R | undefined>;
  prefixes: EmbeddingPrefixes;
}

export const createEncoderEmbeddings = ({
  load,
  release,
  borrow,
  prefixes,
}: EncoderEmbeddingsOptions): WebEmbeddings => {
  let chain: Promise<unknown> = Promise.resolve();

  const embed = async (text: string): Promise<number[]> => {
    const vector = await borrow(encoder => encoder.encode(text));

    if (!vector) {
      throw new Error('Embedding model is not loaded');
    }

    return vector;
  };

  return {
    runWithLoadedModel<T>(operation: () => Promise<T>): Promise<T> {
      const run = chain.then(async () => {
        if (!(await load())) {
          throw new Error('Embedding model could not be loaded');
        }

        try {
          return await operation();
        } finally {
          release();
        }
      });

      chain = run.catch(() => undefined);

      return run;
    },

    embedQuery: text =>
      embed(truncateToTokenBudget(`${prefixes.query}${text}`)),

    embedDocument: text =>
      embed(truncateToTokenBudget(`${prefixes.document}${text}`)),
  };
};
