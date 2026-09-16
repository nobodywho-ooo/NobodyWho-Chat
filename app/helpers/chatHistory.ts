import type { ContentPart, Message } from 'react-native-nobodywho';
import { ChatMessage, DisplayMessage } from 'types';

import {
  messageDocumentExists,
  messageDocumentKind,
  resolveMessageDocumentPath,
} from './messageDocuments';

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

// Rebuild a stored user turn the way the model originally saw it. A turn with
// attachments was sent as a Prompt of interleaved parts (see useChatGeneration:
// the text first, then the image, then the audio), so replaying it as text
// alone hands the model a conversation with holes in it — it is asked to keep
// discussing a picture that is no longer in its context. nobodywho 4's
// ContentPart list is that same interleaving expressed in a message, so the
// reload can restore it.
//
// Only image and audio are passed on: they are what a projection model can
// ingest, and `documentsPath` also holds plain files (messageDocumentKind
// returns 'file'), which the UI lists by name and the model never saw. A
// missing file is skipped rather than sent — the loader reads each path at
// prefill and throws on one it cannot open, which would fail the whole restore
// over a single attachment the user has since cleared.
const userContent = (message: ChatMessage): string | ContentPart[] => {
  const media = message.documentsPath.flatMap((path): ContentPart[] => {
    const kind = messageDocumentKind(path);

    if (kind === 'file' || !messageDocumentExists(path)) {
      return [];
    }

    return [{ type: kind, path: resolveMessageDocumentPath(path) }];
  });

  if (media.length === 0) {
    return message.content;
  }

  return message.content
    ? [{ type: 'text', text: message.content }, ...media]
    : media;
};

// Expand stored messages into the sequence nobodywho expects for
// setChatHistory. An assistant turn that called tools is persisted as ONE row
// (the answer + its toolInvocations), but nobodywho models it as three
// messages: the tool-call request, each tool result, then the answer. Rebuilding
// that natural shape lets a reloaded conversation continue coherently.
//
// `toolCalls` must be present on every assistant message (even empty) or
// setChatHistory crashes — an assistant with no invocations maps to `[]`.
//
// `system` rows are UI-only notices (generation stopped/failed), never part of
// the model's context — they are dropped here.
//
// The result is nobodywho's own `Message`, not a `DisplayMessage`: this list
// only ever reaches setChatHistory, and unlike the display list it carries
// media as message content rather than as the app's out-of-band
// `documentsPath`, which nobodywho would ignore.
export const toModelHistory = (messages: ChatMessage[]): Message[] =>
  messages.flatMap((message): Message[] => {
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
          ...invocations.map((invocation): Message => ({
            role: 'tool',
            name: invocation.name,
            content: invocation.result,
          })),
          { role: 'assistant', content: message.content, toolCalls: [] },
        ];
      }
      case 'system':
        return [];
      case 'user':
      default:
        return [{ role: 'user', content: userContent(message) }];
    }
  });
