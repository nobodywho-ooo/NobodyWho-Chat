import { Message } from 'react-native-nobodywho';

export interface ChatMessage {
  id: number;
  timestamp: string;
  conversationId: number;
  role: string;
  content: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  documentsPath: string[];
}

export type DisplayMessage = Message & {
  tokensPerSecond?: number;
  timeToFirstToken?: number;
};
