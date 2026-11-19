import type { Chat, Message } from 'react-native-nobodywho';
import { log } from 'helpers';

import {
  digestReplyIsComplete,
  updateConversationDigest,
} from './conversationDigest';

interface DigestRun {
  cancel: () => void;
  done: Promise<void>;
}

let current: DigestRun | null = null;

export const settleConversationDigest = async (): Promise<void> => {
  const run = current;
  if (!run) {
    return;
  }
  run.cancel();
  await run.done;
};

export interface DigestUpdateInput {
  chat: Chat;
  previousDigest: string | null;
  question: string;
  answer: string;
  onDigest: (digest: string) => Promise<void> | void;
}

const runDigestUpdate = async (
  { chat, previousDigest, question, answer, onDigest }: DigestUpdateInput,
  isCancelled: () => boolean,
): Promise<void> => {
  const [history, systemPrompt, templateVariables] = await Promise.all([
    chat.getChatHistory(),
    chat.getSystemPrompt(),
    chat.getTemplateVariables(),
  ]);
  let borrowed = false;

  try {
    const digest = await updateConversationDigest(
      async messages => {
        if (isCancelled()) {
          return '';
        }

        borrowed = true;
        let out = '';

        const stream = chat.complete(
          messages.map((message): Message =>
            message.role === 'system'
              ? { role: 'system', content: message.content }
              : message.role === 'assistant'
                ? { role: 'assistant', content: message.content }
                : { role: 'user', content: message.content },
          ),
          {
            templateVariables: { ...templateVariables, enable_thinking: false },
          },
        );

        for await (const token of stream) {
          out += token;

          if (isCancelled() || digestReplyIsComplete(out)) {
            chat.stopGeneration();
            break;
          }
        }

        return out;
      },
      previousDigest,
      question,
      answer,
    );

    if (!isCancelled() && digest && digest !== previousDigest) {
      await onDigest(digest);
    }
  } finally {
    if (borrowed) {
      await chat.setChatHistory(history);
      await chat.setSystemPrompt(systemPrompt);

      for (const [name, value] of Object.entries(templateVariables)) {
        await chat.setTemplateVariable(name, value);
      }
    }
  }
};

export const updateConversationDigestInBackground = async (
  input: DigestUpdateInput,
): Promise<void> => {
  await settleConversationDigest();

  let cancelled = false;
  const run: DigestRun = {
    cancel: () => {
      if (cancelled) {
        return;
      }

      cancelled = true;

      try {
        input.chat.stopGeneration();
      } catch (error) {
        log('Conversation digest stop failed', error);
      }
    },
    done: Promise.resolve(),
  };

  run.done = runDigestUpdate(input, () => cancelled)
    .catch(error => log('Conversation digest update failed', error))
    .finally(() => {
      if (current === run) {
        current = null;
      }
    });
  current = run;
};
