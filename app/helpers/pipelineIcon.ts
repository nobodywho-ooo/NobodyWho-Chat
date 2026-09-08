import type {
  MaterialSymbolProps,
  SFSymbolProps,
} from '@react-navigation/native';
import { ModelPipeline } from 'types';

export interface PipelineIcon {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
}

// So unrecognised model still renders
const DEFAULT_PIPELINE_ICON: PipelineIcon = {
  iosIconName: 'shippingbox',
  androidIconName: 'category',
};

const pipelineIcons: Record<ModelPipeline, PipelineIcon> = {
  [ModelPipeline.textGeneration]: {
    iosIconName: 'text.bubble',
    androidIconName: 'chat',
  },
  [ModelPipeline.imageToImage]: {
    iosIconName: 'photo',
    androidIconName: 'image',
  },
  [ModelPipeline.imageTextToText]: {
    iosIconName: 'photo.on.rectangle',
    androidIconName: 'photo_library',
  },
  [ModelPipeline.audioTextToText]: {
    iosIconName: 'waveform',
    androidIconName: 'graphic_eq',
  },
  [ModelPipeline.imageAudioTextToText]: {
    iosIconName: 'square.grid.2x2',
    androidIconName: 'dashboard',
  },
  [ModelPipeline.featureExtraction]: {
    iosIconName: 'magnifyingglass',
    androidIconName: 'search',
  },
  [ModelPipeline.textRanking]: {
    iosIconName: 'list.number',
    androidIconName: 'format_list_numbered',
  },
  [ModelPipeline.textToSpeech]: {
    iosIconName: 'speaker.wave.2',
    androidIconName: 'text_to_speech',
  },
  [ModelPipeline.speechToText]: {
    iosIconName: 'microphone',
    androidIconName: 'mic',
  },
  [ModelPipeline.voiceActivityDetection]: {
    iosIconName: 'waveform.badge.mic',
    androidIconName: 'record_voice_over',
  },
};

// The platform icon pair standing for a pipeline, so everything that shows a
// pipeline (the model cards, the catalogue's filter pills) labels it the same
// way. Mirrors pipelineLabel, which names the same pipelines in words.
export const getPipelineIcon = (pipeline: ModelPipeline): PipelineIcon =>
  pipelineIcons[pipeline] ?? DEFAULT_PIPELINE_ICON;
