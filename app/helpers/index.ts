import { isIOS, isAndroid, getIOSVersion, isIOS26OrLater } from './platform';
import { log } from './log';
import { capitalize } from './string';
import { safeJsonParse } from './json';
import { getMarkdownStyle } from './markdown';
import { parseThinking, stripThinkingBlocks } from './thinking';
import { haptics } from './haptics';
import { getFamilyIcon } from './familyIcon';
import { getPipelineIcon } from './pipelineIcon';
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
import {
  availableDiskSpaceGB,
  checkDiskSpaceForModel,
  modelDownloadSizeGB,
} from './diskSpace';
import { sleep } from './async';
import {
  captureImageToMessageDocuments,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
} from './mediaPicker';
import {
  isForegroundHeld,
  resetForegroundHoldForTests,
} from './foregroundHold';
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
import { STT_LANGUAGE_OPTIONS, WHISPER_LANGUAGES } from './sttLanguages';
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
  MAX_RECORDING_MS,
  requestMicrophonePermission,
  resetRecordingModeForTests,
} from './audioSession';
import { computeGenerationMetrics } from './generationMetrics';
import { parameterCountLabel } from './parameterCount';
import { modelSizeLabel } from './modelSize';

export type { AudioBands, AudioEnvelope } from './audioLevels';
export type { TtsEngine, TtsLanguageOption } from './ttsEngine';
export type { SttLanguageOption } from './sttLanguages';
export type { PipelineIcon } from './pipelineIcon';
export type { DiskSpaceCheck } from './diskSpace';

export {
  getFamilyIcon,
  getPipelineIcon,
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
  availableDiskSpaceGB,
  checkDiskSpaceForModel,
  modelDownloadSizeGB,
  captureImageToMessageDocuments,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
  isForegroundHeld,
  resetForegroundHoldForTests,
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
  STT_LANGUAGE_OPTIONS,
  WHISPER_LANGUAGES,
  cleanTranscript,
  ttsEngineForArchitecture,
  ttsEngineForFamily,
  ttsEngineForModel,
  micBands,
  wavToEnvelope,
  concatPcm,
  resamplePcm,
  acquireRecordingMode,
  MAX_RECORDING_MS,
  requestMicrophonePermission,
  resetRecordingModeForTests,
  computeGenerationMetrics,
  parameterCountLabel,
  modelSizeLabel,
};
