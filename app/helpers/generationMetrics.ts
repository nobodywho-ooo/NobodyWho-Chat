// Per-turn generation metrics shown under an assistant message: how fast the
// model produced tokens (tok/s) and how long it took to emit the first one
// (time to first token, ms). Both the typed chat path and the voice-assistant
// turn compute them the same way so a voice turn shows the same numbers as a
// typed one once it lands in the chat screen.
export const computeGenerationMetrics = (
  startedAt: number,
  firstTokenAt: number | undefined,
  tokenCount: number,
): { tokensPerSecond?: number; timeToFirstToken?: number } => {
  if (firstTokenAt === undefined || tokenCount === 0) return {};
  const timeToFirstToken = firstTokenAt - startedAt;
  const generationMs = Math.max(Date.now() - firstTokenAt, 1);
  return {
    tokensPerSecond: tokenCount / (generationMs / 1000),
    timeToFirstToken,
  };
};
