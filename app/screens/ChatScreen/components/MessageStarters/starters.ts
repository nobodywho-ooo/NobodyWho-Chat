import { ChatPipeline, ModelPipeline } from 'types';

const CHAT_STARTER_IDS = [
  'planParisTrip',
  'beginMeditating',
  'designWorkoutRoutine',
  'packLight',
  'organizeFinances',
  'tellMeSomethingFascinating',
  'prepareJobInterview',
  'writeProfessionally',
  'startLearningFrench',
  'planVacationTrip',
  'explainComplexTopic',
  'summarizeText',
  'decideDinner',
  'discoverNextBook',
  'boostProductivity',
] as const;

const IMAGE_STARTER_IDS = [
  'describeImage',
  'identifyPlant',
  'analyzeArtwork',
  'identifyAnimal',
] as const;

const AUDIO_STARTER_IDS = ['describeAudio'] as const;

type StarterPool = readonly string[];

const pipelinePools: Record<ChatPipeline, [StarterPool, number][]> = {
  [ModelPipeline.textGeneration]: [[CHAT_STARTER_IDS, 8]],
  [ModelPipeline.imageTextToText]: [
    [IMAGE_STARTER_IDS, 3],
    [CHAT_STARTER_IDS, 5],
  ],
  [ModelPipeline.audioTextToText]: [
    [AUDIO_STARTER_IDS, 3],
    [CHAT_STARTER_IDS, 5],
  ],
  [ModelPipeline.imageAudioTextToText]: [
    [IMAGE_STARTER_IDS, 2],
    [AUDIO_STARTER_IDS, 2],
    [CHAT_STARTER_IDS, 4],
  ],
};

const sample = (pool: StarterPool, count: number): string[] => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

export const pickStarterIds = (pipeline: ChatPipeline): string[] =>
  pipelinePools[pipeline].flatMap(([pool, count]) => sample(pool, count));

export { AUDIO_STARTER_IDS, CHAT_STARTER_IDS, IMAGE_STARTER_IDS };
