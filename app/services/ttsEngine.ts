import * as NobodyWho from 'react-native-nobodywho';

// TODO: This is a fake implementation, implement when ready
export type TtsWav = Uint8Array | string;

export interface TtsInstance {
  synthesize(text: string): Promise<TtsWav>;
  destroy(): void;
}

interface TtsModule {
  load(opts: { source: string }): Promise<TtsInstance>;
}

const ttsModule = (NobodyWho as Record<string, unknown>).Tts as
  | TtsModule
  | undefined;

export const isTtsEngineAvailable = (): boolean => ttsModule !== undefined;

export const loadTtsEngine = (source: string): Promise<TtsInstance> => {
  if (ttsModule === undefined) {
    throw new Error(
      'ttsEngine: this react-native-nobodywho version does not ship Tts yet',
    );
  }
  return ttsModule.load({ source });
};
