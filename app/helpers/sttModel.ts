import { Model } from 'types';

// nobodywho's STT loader chooses which ONNX weights to open from a
// `quantization` hint that maps to the onnx-community filename suffix
// (encoder_model_int8.onnx -> "int8", encoder_model_fp16.onnx -> "fp16", …).
// Its `default` looks for the unsuffixed encoder_model.onnx, but a downloaded
// model only ships the single variant the catalogue lists — so without a
// matching hint the loader looks for files that were never downloaded and the
// engine fails to load. Longest tokens first so e.g. "q4f16" wins over "q4".
const STT_QUANTIZATIONS = [
  'q4f16',
  'fp16',
  'int8',
  'uint8',
  'bnb4',
  'q4',
  'quantized',
] as const;

// Derives the quantization hint for an STT model from its encoder ONNX part's
// filename, so it always matches whatever variant was actually downloaded (no
// per-model config needed). Returns undefined for an unsuffixed model, letting
// the engine keep its own default.
export const resolveSttQuantization = (model: Model): string | undefined => {
  const onnxParts = model.parts.filter(part =>
    part.fileName.toLowerCase().endsWith('.onnx'),
  );

  // Whisper exports ship the encoder and decoder as separate ONNX files, and
  // not always at the same quantization. The loader's `quantization` selects
  // the encoder's variant, so prefer that part; taking whichever .onnx happens
  // to come first in the catalogue can hand it the decoder's suffix and send it
  // looking for encoder weights that were never downloaded. Falls back to the
  // only file for single-part models.
  const onnxPart =
    onnxParts.find(part => part.fileName.toLowerCase().includes('encoder')) ??
    onnxParts[0];

  if (!onnxPart) {
    return undefined;
  }

  const stem = onnxPart.fileName
    .toLowerCase()
    .replace(/^.*\//, '')
    .replace(/\.onnx$/, '');

  return STT_QUANTIZATIONS.find(quantization =>
    stem.endsWith(`_${quantization}`),
  );
};
