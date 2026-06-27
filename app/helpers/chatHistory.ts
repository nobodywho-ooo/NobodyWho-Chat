import { ChatMessage, DisplayMessage } from 'types';

// Convert stored messages (ChatMessage rows) into the DisplayMessage list the
// chat UI renders — one message per row. The assistant's `toolInvocations` ride
// along for the tool blocks; the model's own context on reload is built by
// toModelHistory (that is what actually goes to chat.setChatHistory).
export const toChatHistory = (messages: ChatMessage[]): DisplayMessage[] =>
  messages.map((message): DisplayMessage => {
    switch (message.role) {
      case 'assistant':
        return {
          role: 'assistant',
          content: message.content,
          tokensPerSecond: message.tokensPerSecond,
          timeToFirstToken: message.timeToFirstToken,
          toolInvocations: message.toolInvocations,
        };
      case 'system':
        return {
          role: 'system',
          content: message.content,
        };
      case 'user':
      default:
        return {
          role: 'user',
          content: message.content,
          documentsPath: message.documentsPath,
        };
    }
  });

// Expand stored messages into the sequence nobodywho expects for
// setChatHistory. An assistant turn that called tools is persisted as ONE row
// (the answer + its toolInvocations), but nobodywho models it as three
// messages: the tool-call request, each tool result, then the answer. Rebuilding
// that natural shape lets a reloaded conversation continue coherently.
//
// `toolCalls` must be present on every assistant message (even empty) or
// setChatHistory crashes — an assistant with no invocations maps to `[]`.
export const toModelHistory = (messages: ChatMessage[]): DisplayMessage[] =>
  messages.flatMap((message): DisplayMessage[] => {
    switch (message.role) {
      case 'assistant': {
        const invocations = message.toolInvocations ?? [];
        if (invocations.length === 0) {
          return [
            { role: 'assistant', content: message.content, toolCalls: [] },
          ];
        }
        return [
          {
            role: 'assistant',
            content: '',
            toolCalls: invocations.map(invocation => ({
              name: invocation.name,
              argumentsJson: JSON.stringify(invocation.arguments),
            })),
          },
          ...invocations.map(
            (invocation): DisplayMessage => ({
              role: 'tool',
              name: invocation.name,
              content: invocation.result,
            }),
          ),
          { role: 'assistant', content: message.content, toolCalls: [] },
        ];
      }
      case 'system':
        return [{ role: 'system', content: message.content }];
      case 'user':
      default:
        return [
          {
            role: 'user',
            content: message.content,
            documentsPath: message.documentsPath,
          },
        ];
    }
  });
