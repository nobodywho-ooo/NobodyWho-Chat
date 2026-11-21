import type { WebSearchTelemetry } from '../runWebSearch';
import { recordWebSearchTrace, type WebSearchTrace } from '../searchTrace';
import { writeTraceFile } from '../traceFile';

jest.mock('../traceFile', () => ({
  writeTraceFile: jest.fn(async () => undefined),
}));

const writeTraceFileMock = writeTraceFile as jest.MockedFunction<
  typeof writeTraceFile
>;

const telemetry: WebSearchTelemetry = {
  needsSearch: true,
  intent: 'who holds the office now',
  plannedQueries: ['presidente del consiglio in carica'],
  rounds: [],
  providerCalls: 1,
  enginesTried: ['duckduckgo'],
  finalConfidence: 0.4,
  finalLabel: 'ambiguous',
  agreement: {
    independentHosts: 1,
    repeatedHostResults: 0,
    corroborated: [],
    singleSourced: [],
    agreementRatio: 0,
  },
  fetchFailures: [],
  recovery: [],
};

const trace = (question: string): WebSearchTrace => ({
  question,
  expects: ['name of the office holder'],
  planQueries: ['presidente del consiglio in carica'],
  budget: 2000,
  contextOffset: 0,
  candidates: [
    'https://it.wikipedia.org/wiki/Presidenti',
    'https://www.governo.it/it/il-presidente',
  ],
  results: [
    {
      title: 'Presidenti del Consiglio',
      url: 'https://it.wikipedia.org/wiki/Presidenti',
      snippet: 'dal 1861 a oggi',
      content: 'Fernando Tambroni ... Giorgia Meloni, in carica',
      sourceQuery: 'presidente del consiglio in carica',
    },
  ],
  context: ['[1] Presidenti del Consiglio\nGiorgia Meloni, in carica'],
  telemetry,
});

beforeEach(() => {
  writeTraceFileMock.mockClear();
});

describe('recordWebSearchTrace', () => {
  it('ships off, so a release build writes nothing', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'));

    expect(writeTraceFileMock).not.toHaveBeenCalled();
  });

  it('writes one file per search into the trace directory', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'), {
      toFile: true,
      keepFiles: 5,
    });

    expect(writeTraceFileMock).toHaveBeenCalledWith(
      'web-traces',
      'chi e il presidente del consiglio',
      expect.any(String),
      5,
    );
  });

  it('records the page text and the context the model was handed', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'), {
      toFile: true,
    });

    const parsed = JSON.parse(writeTraceFileMock.mock.calls[0]![2]);
    expect(parsed.sources[0].url).toBe(
      'https://it.wikipedia.org/wiki/Presidenti',
    );
    expect(parsed.sources[0].content).toContain('Tambroni');
    expect(parsed.candidates).toContain(
      'https://www.governo.it/it/il-presidente',
    );
    expect(parsed.budget).toBe(2000);
    expect(parsed.context[0]).toContain('in carica');
    expect(parsed.telemetry.finalLabel).toBe('ambiguous');
  });
});
