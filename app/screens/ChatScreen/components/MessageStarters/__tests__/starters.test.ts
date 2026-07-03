import { ModelPipeline } from 'types';

import {
  AUDIO_STARTER_IDS,
  CHAT_STARTER_IDS,
  IMAGE_STARTER_IDS,
  pickStarterIds,
} from '../starters';

type Segment = [readonly string[], number];

// Assert the picked ids are laid out as consecutive segments, each drawn
// (without duplicates) from its pool. A pool smaller than the requested count
// yields the whole pool.
const expectSegments = (ids: string[], segments: Segment[]) => {
  let offset = 0;
  segments.forEach(([pool, count]) => {
    const expectedCount = Math.min(count, pool.length);
    const segment = ids.slice(offset, offset + expectedCount);
    expect(segment).toHaveLength(expectedCount);
    expect(new Set(segment).size).toBe(expectedCount);
    segment.forEach(id => expect(pool).toContain(id));
    offset += expectedCount;
  });
  expect(ids).toHaveLength(offset);
};

test('text generation picks 8 chat starters', () => {
  expectSegments(pickStarterIds(ModelPipeline.textGeneration), [
    [CHAT_STARTER_IDS, 8],
  ]);
});

test('image models pick 3 image starters, then 5 chat starters', () => {
  expectSegments(pickStarterIds(ModelPipeline.imageTextToText), [
    [IMAGE_STARTER_IDS, 3],
    [CHAT_STARTER_IDS, 5],
  ]);
});

test('audio models pick 3 audio starters, then 5 chat starters', () => {
  expectSegments(pickStarterIds(ModelPipeline.audioTextToText), [
    [AUDIO_STARTER_IDS, 3],
    [CHAT_STARTER_IDS, 5],
  ]);
});

test('image+audio models pick 2 image, 2 audio, then 4 chat starters', () => {
  expectSegments(pickStarterIds(ModelPipeline.imageAudioTextToText), [
    [IMAGE_STARTER_IDS, 2],
    [AUDIO_STARTER_IDS, 2],
    [CHAT_STARTER_IDS, 4],
  ]);
});

test('the selection is shuffled, not just the first N of the pool', () => {
  // 20 draws of 8-of-17 all matching the pool's own order is ~impossible; any
  // shuffle at all makes at least one draw differ.
  const firstEight = CHAT_STARTER_IDS.slice(0, 8);
  const draws = Array.from({ length: 20 }, () =>
    pickStarterIds(ModelPipeline.textGeneration),
  );
  expect(
    draws.some(ids => ids.some((id, index) => id !== firstEight[index])),
  ).toBe(true);
});
