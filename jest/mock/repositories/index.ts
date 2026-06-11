import { deleteConversation } from 'repositories';

jest.mock('repositories', () => ({
  ...jest.requireActual('repositories'),
  deleteConversation: jest.fn(),
}));

export const mockDeleteConversation = deleteConversation as jest.Mock;
