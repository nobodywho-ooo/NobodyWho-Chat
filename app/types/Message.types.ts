export interface ChatMessage {
  id: number;
  timestamp: string;
  chatId: number;
  role: string;
  content: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  documentsPath: string[];
}
