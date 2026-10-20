import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import {
  curatedChatModel,
  CURATED_VOICE_ONLY_MODELS,
  CURATED_VOICE_PIPELINE_MODELS,
  ModelInventory,
  onboardingChatModels,
  curatedAvailability,
} from '../curatedModels';

const part = (sizeGB: number) => ({
  url: 'https://example.com/model.gguf',
  fileName: 'model.gguf',
  type: 'chat-model',
  path: '',
  sizeGB,
});

const chat = buildModel(1, { tags: ['Great First Pick'], parts: [part(1)] });
const stt = buildModel(2, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
  parts: [part(0.5)],
});
const tts = buildModel(3, {
  pipeline: ModelPipeline.textToSpeech,
  tags: ['Recommended'],
  parts: [part(0.5)],
});
const vad = buildModel(4, {
  pipeline: ModelPipeline.voiceActivityDetection,
  tags: ['Recommended'],
  parts: [part(0.5)],
});

// 8 GB on iOS leaves 6 GB once the OS has its share.
const inventory = (
  overrides: Partial<ModelInventory> = {},
): ModelInventory => ({
  installed: [],
  downloads: [],
  inUseIds: [],
  catalogue: { models: [chat, stt, tts, vad], ramGB: 8 },
  ...overrides,
});

const downloadOf = (model: typeof chat) => ({ model, partsProgress: [] });

describe('curatedAvailability', () => {
  test('downloads every missing model in one go when they fit', () => {
    expect(
      curatedAvailability(CURATED_VOICE_PIPELINE_MODELS, inventory()),
    ).toEqual({
      kind: 'automatic',
      models: [chat, stt, tts, vad],
      sizeGB: 2.5,
    });
  });

  test('is ready once everything is installed', () => {
    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ installed: [chat, stt, tts, vad] }),
      ),
    ).toEqual({ kind: 'ready' });
  });

  test('follows the downloads covering what is not installed', () => {
    const sttDownload = downloadOf(stt);

    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ installed: [chat, tts, vad], downloads: [sttDownload] }),
      ),
    ).toEqual({ kind: 'inProgress', downloads: [sttDownload] });
  });

  test('downloads only what neither the installed models nor the downloads cover', () => {
    const availability = curatedAvailability(
      CURATED_VOICE_PIPELINE_MODELS,
      inventory({ installed: [chat], downloads: [downloadOf(stt)] }),
    );

    expect(availability).toEqual(
      expect.objectContaining({ models: [tts, vad] }),
    );
  });

  test('leaves it to the user when a model is not in the catalogue', () => {
    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ catalogue: { models: [chat, stt, vad], ramGB: 8 } }),
      ),
    ).toEqual({ kind: 'manual' });
  });

  test('leaves it to the user when the models do not fit together', () => {
    // 2.5 GB for the set, 2 GB usable: each would fit on its own.
    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ catalogue: { models: [chat, stt, tts, vad], ramGB: 4 } }),
      ),
    ).toEqual({ kind: 'manual' });
  });

  test('counts the chat model in use when several are installed', () => {
    const smallChat = buildModel(5, { parts: [part(0.5)] });
    const bigChat = buildModel(6, { parts: [part(5)] });
    const availability = (inUseIds: number[]) =>
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ installed: [smallChat, bigChat], inUseIds }),
      ).kind;

    // 0.5 + 1.5 GB of voice models fits 6 GB; 5 + 1.5 does not.
    expect(availability([smallChat.id])).toBe('automatic');
    expect(availability([bigChat.id])).toBe('manual');
  });

  test('counts a download on its way as held in memory', () => {
    const bigChat = buildModel(6, { parts: [part(5)] });

    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ downloads: [downloadOf(bigChat)] }),
      ),
    ).toEqual({ kind: 'manual' });
  });

  test('takes the models to fit when the device RAM is unknown', () => {
    expect(
      curatedAvailability(
        CURATED_VOICE_ONLY_MODELS,
        inventory({ catalogue: { models: [stt, tts, vad], ramGB: undefined } }),
      ).kind,
    ).toBe('automatic');
  });

  test('waits for the catalogue, unless nothing is missing', () => {
    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ catalogue: 'loading' }),
      ),
    ).toEqual({ kind: 'loading' });
    expect(
      curatedAvailability(
        [curatedChatModel(chat.id)],
        inventory({ catalogue: 'loading', installed: [chat] }),
      ),
    ).toEqual({ kind: 'ready' });
  });

  test('leaves it to the user when the catalogue could not be fetched', () => {
    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ catalogue: 'failed' }),
      ),
    ).toEqual({ kind: 'manual' });
  });

  test("any chat model covers the default pick, but not the user's own pick", () => {
    const otherChat = buildModel(9);

    expect(
      curatedAvailability(
        CURATED_VOICE_PIPELINE_MODELS,
        inventory({ installed: [otherChat] }),
      ),
    ).toEqual(expect.objectContaining({ models: [stt, tts, vad] }));
    expect(
      curatedAvailability(
        [curatedChatModel(chat.id)],
        inventory({ installed: [otherChat] }),
      ),
    ).toEqual(expect.objectContaining({ models: [chat] }));
  });
});

describe('onboardingChatModels', () => {
  const recommended = buildModel(10, {
    tags: ['Recommended'],
    order: 2,
    parts: [part(1)],
  });
  const firstPick = buildModel(11, {
    tags: ['Great First Pick'],
    order: 1,
    parts: [part(0.5)],
  });
  const untagged = buildModel(12, { parts: [part(0.1)] });

  test('offers the suggested chat models in catalogue order', () => {
    expect(
      onboardingChatModels({
        models: [recommended, firstPick, untagged, stt],
        ramGB: 8,
      }),
    ).toEqual([firstPick, recommended]);
  });

  test('drops the ones the device cannot run', () => {
    // 2.75 GB on iOS leaves 0.75 GB.
    expect(
      onboardingChatModels({ models: [recommended, firstPick], ramGB: 2.75 }),
    ).toEqual([firstPick]);
  });

  test('offers none when no suggested model fits, whatever else does', () => {
    expect(
      onboardingChatModels({ models: [recommended, untagged], ramGB: 2.5 }),
    ).toEqual([]);
  });
});
