import { buildModel } from 'jest/factories/model';
import { ModelPipeline, ModelPart } from 'types';

import { resolveSttQuantization } from '../sttModel';

const sttModel = (fileName: string) =>
  buildModel(1, {
    pipeline: ModelPipeline.speechToText,
    parts: [
      {
        url: `https://example.com/${fileName}`,
        fileName,
        type: 'stt-file',
        path: `/models/1/${fileName}`,
        sizeGB: 0.1,
      } as ModelPart,
    ],
  });

test('derives the quantization from the encoder ONNX filename suffix', () => {
  expect(resolveSttQuantization(sttModel('onnx/encoder_model_int8.onnx'))).toBe(
    'int8',
  );
  expect(resolveSttQuantization(sttModel('onnx/encoder_model_fp16.onnx'))).toBe(
    'fp16',
  );
});

test('prefers the longer q4f16 token over q4', () => {
  expect(
    resolveSttQuantization(sttModel('onnx/encoder_model_q4f16.onnx')),
  ).toBe('q4f16');
  expect(resolveSttQuantization(sttModel('onnx/encoder_model_q4.onnx'))).toBe(
    'q4',
  );
});

test('returns undefined for an unsuffixed model so the engine keeps its default', () => {
  expect(
    resolveSttQuantization(sttModel('onnx/encoder_model.onnx')),
  ).toBeUndefined();
});

test('ignores non-ONNX parts and returns undefined when there is no ONNX file', () => {
  const model = buildModel(1, {
    pipeline: ModelPipeline.speechToText,
    parts: [
      {
        url: 'https://example.com/config.json',
        fileName: 'config.json',
        type: 'stt-file',
        path: '/models/1/config.json',
        sizeGB: 0.01,
      } as ModelPart,
    ],
  });
  expect(resolveSttQuantization(model)).toBeUndefined();
});
