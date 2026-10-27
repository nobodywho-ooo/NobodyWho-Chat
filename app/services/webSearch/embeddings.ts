import type { Encoder } from 'react-native-nobodywho';

import { truncateToTokenBudget } from './text/textChunking';

// What web retrieval needs from an embedding model. The model is only resident
// for the length of `runWithLoadedModel`: it sits next to the chat model, so
// holding it between searches would cost its memory for the whole session.
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

// Retrieval embedders are trained with a role marker in front of each text and
// score noticeably worse without it. Keyed by a substring of the catalogue
// family, lower-cased; a family that matches none embeds the bare text.
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
  // Loads the encoder; resolves false when it could not be (superseded by a
  // dispose, or no model), in which case the operation is not run.
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
  // Retrieval for one search finishes before the next starts, so a chained
  // operation never overlaps another's load/release pair.
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
