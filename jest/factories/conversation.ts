import { Conversation } from 'types';

export const buildConversation = (
  id: number,
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id,
  title: `Conversation ${id}`,
  lastUsed: '2026-01-01T00:00:00.000Z',
  modelId: 1,
  ...overrides,
});
