import { Message } from 'react-native-nobodywho';
import type { A2UiSurface } from '../services/a2ui/types';

export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
}

export interface WebSource {
  name: string;
  url?: string;
  passage?: string;
  query?: string;
  used?: boolean;
  read?: boolean;
  sourceNumber?: number;
}

export interface ChatMessage {
  id: number;
  timestamp: string;
  conversationId: number;
  role: string;
  content: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  webSearchMs?: number;
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
  webSearchMs?: number;
  documentsPath?: string[];
  toolInvocations?: ToolInvocation[];
  webSources?: WebSource[];
  refining?: boolean;
  uid?: string;
  /** Live A2UI card being streamed for the current turn (not persisted). */
  a2uiLive?: A2UiSurface | null;
};
