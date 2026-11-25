import {
  estimatePromptTokens,
  getContextWindowTokens,
  getPromptCharBudget,
  getPromptTokenBudget,
  PROMPT_TOKEN_SAFETY,
} from '../constants/context-window';
import { scaledGenerationReserve, type WebModel } from '../modelProfile';

const makeModel = (overrides: Partial<WebModel> = {}): WebModel => ({
  name: 'Test',
  family: 'Test',
  parameterCountBillions: 4,
  parts: [],
  sizeGB: 2,
  ...overrides,
});

describe('getContextWindowTokens', () => {
  it('keeps the 2048 default for every family when the chat context is unknown', () => {
    for (const family of [
      'Qwen 3',
      'Qwen 2.5',
      'LLaMA 3.2',
      'LFM 2.5',
      'Gemma 4',
      'Some Custom Family',
    ]) {
      expect(getContextWindowTokens(makeModel({ family }))).toBe(2048);
    }
  });

  it('uses the context the chat was created with', () => {
    expect(
      getContextWindowTokens(makeModel({ contextWindowTokens: 8192 })),
    ).toBe(8192);
  });
});

describe('getPromptTokenBudget', () => {
  it('leaves the scaled generation reserve out of the context window', () => {
    expect(getPromptTokenBudget(makeModel())).toBe(
      2048 - scaledGenerationReserve(2048),
    );
    expect(getPromptTokenBudget(makeModel({ contextWindowTokens: 8192 }))).toBe(
      8192 - scaledGenerationReserve(8192),
    );
  });
});

describe('estimatePromptTokens', () => {
  it('is calibrated to the density measured on device for Polish', () => {
    const polish =
      'Dyrektorem finansowym spółki Zephyria jest Marta Kowalczyk-Nowak, ' +
      'powołana na to stanowisko 12 marca 2024 roku. Odpowiada za politykę ' +
      'budżetową oraz raportowanie kwartalne do rady nadzorczej. ';
    const sample = polish
      .repeat(Math.ceil(8320 / polish.length))
      .slice(0, 8320);

    const density = estimatePromptTokens(sample) / sample.length;

    expect(density).toBeGreaterThan(0.26);
    expect(density).toBeLessThan(0.34);
  });

  it('charges CJK far more per character than Latin', () => {
    const latin = 'the quick brown fox jumps over the lazy dog'.repeat(10);
    const chinese = '泽菲里亚能源公司在波兰设有三个生产基地'.repeat(10);

    const latinPerChar = estimatePromptTokens(latin) / latin.length;
    const chinesePerChar = estimatePromptTokens(chinese) / chinese.length;

    expect(latinPerChar).toBeLessThan(0.3);
    expect(chinesePerChar).toBeGreaterThanOrEqual(0.9);
  });

  it('handles surrogate pairs as single code points', () => {
    expect(estimatePromptTokens('🚀')).toBe(1);
  });

  it('returns zero for empty text', () => {
    expect(estimatePromptTokens('')).toBe(0);
  });
});

describe('getPromptCharBudget', () => {
  it('falls back to a safe Latin density when given no sample', () => {
    const flat = Math.floor(
      Math.floor(getPromptTokenBudget(makeModel()) * PROMPT_TOKEN_SAFETY) * 3,
    );
    expect(getPromptCharBudget(makeModel())).toBe(flat);
  });

  it('grants Latin prose more characters than the flat fallback', () => {
    const english =
      'The quarterly report covers revenue, headcount and logistics. '.repeat(
        20,
      );

    expect(getPromptCharBudget(makeModel(), english)).toBeGreaterThan(
      getPromptTokenBudget(makeModel()) * PROMPT_TOKEN_SAFETY * 3,
    );
  });

  it('shrinks the budget for CJK so the prompt stays under the cap', () => {
    const chinese = '泽菲里亚能源公司在波兰设有三个生产基地。'.repeat(20);

    const budget = getPromptCharBudget(makeModel(), chinese);

    expect(budget).toBeLessThanOrEqual(getPromptTokenBudget(makeModel()));
    const filled = chinese
      .repeat(Math.ceil(budget / chinese.length) + 1)
      .slice(0, budget);
    expect(estimatePromptTokens(filled)).toBeLessThanOrEqual(
      getPromptTokenBudget(makeModel()),
    );
  });

  it('keeps any script under the prompt token budget when filled to capacity', () => {
    const samples = [
      'Zephyria renewable energy quarterly report. ',
      'Компания Зефирия управляет тремя заводами в Польше. ',
      'شركة زفيريا تدير ثلاثة مصانع في بولندا. ',
      '泽菲里亚能源公司在波兰设有三个生产基地。',
      'ゼフィリア・エナジーはポーランドに三つの工場を持っています。',
      'บริษัทเซฟีเรียมีโรงงานสามแห่งในโปแลนด์ ',
    ];

    for (const sample of samples) {
      const text = sample.repeat(200);
      const budget = getPromptCharBudget(makeModel(), text);
      const filled = text.slice(0, budget);
      expect(estimatePromptTokens(filled)).toBeLessThanOrEqual(
        getPromptTokenBudget(makeModel()),
      );
    }
  });
});
