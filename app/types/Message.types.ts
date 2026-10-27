import { Message } from 'react-native-nobodywho';

export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
}

// A web page an answer was grounded in (see services/webSearch).
export interface WebSource {
  name: string;
  url?: string;
  passage?: string;
  query?: string;
  // Whether its text reached the model, and whether the page itself could be
  // read (false: only the search snippet was used).
  used?: boolean;
  read?: boolean;
}

export interface ChatMessage {
  id: number;
  timestamp: string;
  conversationId: number;
  role: string;
  content: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  documentsPath: string[];
  toolInvocations?: ToolInvocation[];
  webSources?: WebSource[];
}

type WithTextContent<T> = T extends { content: unknown }
  ? Omit<T, 'content'> & { content: string }
  : T;

export type DisplayMessage = WithTextContent<Message> & {
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  documentsPath?: string[];
  toolInvocations?: ToolInvocation[];
  webSources?: WebSource[];
  uid?: string;
};
