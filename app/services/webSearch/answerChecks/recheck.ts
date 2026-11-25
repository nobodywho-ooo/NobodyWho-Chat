import type { WebIntentKind } from '../intentKind';
import {
  answerLanguageAnchor,
  languageInstruction,
} from '../prompt/webTurnPrompt';
import {
  detectQuestionLanguage,
  type QuestionLanguage,
} from '../text/questionLanguage';

import {
  answerUsesNoRetrievedEvidence,
  buriesFigureContextOffers,
  claimsMissingEvidenceItHas,
  isWrongLanguageAnswer,
  retryDropsGroundedDetail,
} from './detectors';
import {
  answerStatesFigure,
  evidenceLinesFor,
  visibleAnswer,
} from './evidence';

export const ANSWER_RECHECK_TIME_BUDGET_MS = 40_000;

export type AnswerRecheckReason =
  'wrongLanguage' | 'missingEvidence' | 'ignoresEvidence' | 'buriesFigure';

export interface AnswerCheckInput {
  question: string;
  context: string;
  intentKind?: WebIntentKind;
}

export interface AnswerRecheck {
  reason: AnswerRecheckReason;
  prompt: string;
  continuesConversation: boolean;
  accepts: (retried: string) => boolean;
}

const WRONG_LANGUAGE_RETRY_PROMPT =
  'That reply was written in the wrong language. Write the same answer again, ' +
  'with the same facts, in the language of the question, and do not switch ' +
  'language or script partway through.';

const EVIDENCE_PRESENT_RETRY_PROMPT =
  'The block does contain a figure of the kind the question asks for. Read it ' +
  'again, including the page titles, find that value and answer with it. Only ' +
  'if it truly is not there, say so.';

const SOURCES_COVER_TOPIC_RETRY_PROMPT =
  'The sources do discuss what the question asks about. Answer the ' +
  'question directly in your first sentence with the fact or figure the ' +
  'sources give, exactly as they give it. Do not describe, list or ' +
  'summarize the sources. If they cover it only in part, give that part ' +
  'instead of refusing.';

const FOCUSED_RETRY_INSTRUCTION =
  'The lines below were quoted from the sources retrieved for the question. ' +
  'They are the only material to answer from; do not add anything from memory.';

const focusedEvidencePrompt = (question: string, lines: string[]): string =>
  'Answer the question in one or two sentences, giving the figure the lines ' +
  'state in the first sentence, exactly as they give it. If the lines do not ' +
  'hold it, say the sources do not state it.\n' +
  `${lines.map(line => `"${line}"`).join('\n')}\n\nQuestion: ${question}`;

interface RetryPrompt {
  prompt: string;
  continuesConversation: boolean;
}

const continuedRetry = (
  prompt: string,
  language: QuestionLanguage | null,
): RetryPrompt => ({
  prompt: prompt + answerLanguageAnchor(language),
  continuesConversation: true,
});

const evidenceRetry = (
  prompt: string,
  { question, context }: AnswerCheckInput,
  language: QuestionLanguage | null,
): RetryPrompt => {
  const lines = evidenceLinesFor(question, context);
  if (lines.length === 0) {
    return continuedRetry(prompt, language);
  }

  return {
    prompt:
      `${FOCUSED_RETRY_INSTRUCTION}\n${languageInstruction(language)}\n\n` +
      focusedEvidencePrompt(question, lines) +
      answerLanguageAnchor(language),
    continuesConversation: false,
  };
};

const acceptance =
  (
    draft: string,
    stillBroken: (retried: string) => boolean,
    preserveDetail: boolean,
  ) =>
  (retried: string): boolean =>
    visibleAnswer(retried) !== '' &&
    !stillBroken(retried) &&
    !(preserveDetail && retryDropsGroundedDetail(draft, retried));

export const planAnswerRecheck = (
  draft: string,
  input: AnswerCheckInput,
): AnswerRecheck | null => {
  const { question, context, intentKind } = input;

  if (!visibleAnswer(draft) || !context.trim()) {
    return null;
  }

  const language = detectQuestionLanguage(question);
  const wrongLanguage = (text: string) => isWrongLanguageAnswer(text, question);

  if (wrongLanguage(draft)) {
    return {
      reason: 'wrongLanguage',
      ...continuedRetry(WRONG_LANGUAGE_RETRY_PROMPT, language),
      accepts: acceptance(draft, wrongLanguage, false),
    };
  }

  const claimsMissing = (text: string) =>
    claimsMissingEvidenceItHas(text, question, context, intentKind);

  if (claimsMissing(draft)) {
    return {
      reason: 'missingEvidence',
      ...evidenceRetry(EVIDENCE_PRESENT_RETRY_PROMPT, input, language),
      accepts: acceptance(
        draft,
        retried => claimsMissing(retried) || wrongLanguage(retried),
        true,
      ),
    };
  }

  const ignoresEvidence = (text: string) =>
    answerUsesNoRetrievedEvidence(text, question, context);
  const buriesFigure = (text: string) =>
    buriesFigureContextOffers(text, question, context, intentKind);

  if (ignoresEvidence(draft) || buriesFigure(draft)) {
    const draftStatesFigure = answerStatesFigure(
      visibleAnswer(draft),
      question,
    );
    const statesWhatDraftLacks = (retried: string) =>
      !draftStatesFigure &&
      answerStatesFigure(visibleAnswer(retried), question);

    return {
      reason: ignoresEvidence(draft) ? 'ignoresEvidence' : 'buriesFigure',
      ...evidenceRetry(SOURCES_COVER_TOPIC_RETRY_PROMPT, input, language),
      accepts: acceptance(
        draft,
        retried =>
          ((ignoresEvidence(retried) || buriesFigure(retried)) &&
            !statesWhatDraftLacks(retried)) ||
          wrongLanguage(retried),
        true,
      ),
    };
  }

  return null;
};
