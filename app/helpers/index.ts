import { isIOS, isAndroid, getIOSVersion, isIOS26OrLater } from './platform';
import { log } from './log';
import { capitalize } from './string';
import { safeJsonParse } from './json';
import { getMarkdownStyle } from './markdown';
import { parseThinking, stripThinkingBlocks } from './thinking';
import { haptics } from './haptics';
import { getFamilyIcon } from './familyIcon';
import { copyToClipboard } from './clipboard';
import { deleteModelFiles } from './modelFiles';
import {
  downloadModelPart,
  downloadedPartPath,
  deleteModelDirectory,
  modelDirectoryPath,
  listModelFiles,
  listModelSubdirectories,
} from './modelDownload';
import { toFileUri, toPlainPath } from './fileUri';
import {
  filterModelsByDeviceMemory,
  modelRequiredMemoryGB,
} from './deviceMemory';
import { sleep } from './async';
import {
  captureImageToMessageDocuments,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
  isExternalPickerActive,
} from './mediaPicker';
import {
  deleteMessageDocuments,
  messageDocumentName,
  messageDocumentKind,
  messageDocumentUri,
  resolveMessageDocumentPath,
} from './messageDocuments';
import { toChatHistory, toModelHistory } from './chatHistory';
import {
  splitIntoChunks,
  concatWavs,
  synthesizeChunked,
  synthesizeSpeech,
} from './ttsAudio';
import { resolveTtsPrefs } from './ttsVoices';
import { resolveSttQuantization } from './sttModel';
import { cleanTranscript } from './transcript';
import {
  ttsEngineForArchitecture,
  ttsEngineForFamily,
  ttsEngineForModel,
} from './ttsEngine';
import { micBands, wavToEnvelope } from './audioLevels';
import { concatPcm, resamplePcm } from './pcm';
import {
  acquireRecordingMode,
  resetRecordingModeForTests,
} from './audioSession';
import { computeGenerationMetrics } from './generationMetrics';
import { parameterCountLabel } from './parameterCount';
import { modelSizeLabel } from './modelSize';

export type { AudioBands, AudioEnvelope } from './audioLevels';
export type { TtsEngine, TtsLanguageOption } from './ttsEngine';

export {
  getFamilyIcon,
  deleteModelFiles,
  downloadModelPart,
  downloadedPartPath,
  deleteModelDirectory,
  modelDirectoryPath,
  listModelFiles,
  listModelSubdirectories,
  toFileUri,
  toPlainPath,
  filterModelsByDeviceMemory,
  modelRequiredMemoryGB,
  captureImageToMessageDocuments,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
  isExternalPickerActive,
  deleteMessageDocuments,
  messageDocumentName,
  messageDocumentKind,
  messageDocumentUri,
  resolveMessageDocumentPath,
  isIOS,
  isAndroid,
  getIOSVersion,
  isIOS26OrLater,
  log,
  capitalize,
  safeJsonParse,
  getMarkdownStyle,
  parseThinking,
  stripThinkingBlocks,
  haptics,
  copyToClipboard,
  sleep,
  toChatHistory,
  toModelHistory,
  splitIntoChunks,
  concatWavs,
  synthesizeChunked,
  synthesizeSpeech,
  resolveTtsPrefs,
  resolveSttQuantization,
  cleanTranscript,
  ttsEngineForArchitecture,
  ttsEngineForFamily,
  ttsEngineForModel,
  micBands,
  wavToEnvelope,
  concatPcm,
  resamplePcm,
  acquireRecordingMode,
  resetRecordingModeForTests,
  computeGenerationMetrics,
  parameterCountLabel,
  modelSizeLabel,
};
