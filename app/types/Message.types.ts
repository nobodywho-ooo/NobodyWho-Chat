import { Message } from 'react-native-nobodywho';

export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
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
}

export type DisplayMessage = Message & {
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  documentsPath?: string[];
  toolInvocations?: ToolInvocation[];
};
