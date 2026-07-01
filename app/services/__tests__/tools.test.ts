import { ToolInvocation } from 'types';

import {
  metersToFeet,
  feetToMeters,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  fetchWeather,
  fetchWikipedia,
  fetchStockQuote,
  buildChatTools,
  subscribeToolInvocations,
} from '../tools';

// The mocked Tool (jest/mock/node-modules) stores its constructor opts, so we
// can invoke a tool's `call` directly to exercise the conversion logic + the
// instrument() listener wrapper.
type MockTool = { opts: { name: string; call: (...args: any[]) => Promise<string> } };
const toolByName = (name: string): MockTool['opts'] => {
  const tool = (buildChatTools() as unknown as MockTool[]).find(
    t => t.opts.name === name,
  );
  if (!tool) throw new Error(`tool ${name} not built`);
  return tool.opts;
};

describe('unit conversions', () => {
  test('metres <-> feet round-trips and matches known values', () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 4);
    expect(feetToMeters(3.28084)).toBeCloseTo(1, 4);
    expect(feetToMeters(metersToFeet(42))).toBeCloseTo(42, 6);
  });

  test('celsius <-> fahrenheit matches known values', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(celsiusToFahrenheit(37))).toBeCloseTo(37, 6);
  });
});

describe('buildChatTools', () => {
  test('builds the weather, wikipedia, and converter tools', () => {
    const names = (buildChatTools() as unknown as MockTool[]).map(
      t => t.opts.name,
    );
    expect(names).toEqual([
      'get_weather',
      'search_wikipedia',
      'get_stock_quote',
      'convert_length',
      'convert_temperature',
    ]);
  });

  test('a converter tool returns the converted value as JSON', async () => {
    const result = await toolByName('convert_temperature').call(
      100,
      'celsius',
      'fahrenheit',
    );
    expect(JSON.parse(result)).toEqual({
      value: 100,
      from: 'celsius',
      to: 'fahrenheit',
      result: 212,
    });
  });

  test('a tool call reports a structured invocation to subscribers', async () => {
    const invocations: ToolInvocation[] = [];
    const unsubscribe = subscribeToolInvocations(invocation =>
      invocations.push(invocation),
    );

    const result = await toolByName('convert_temperature').call(
      100,
      'celsius',
      'fahrenheit',
    );

    // Arguments are reassembled by name from the positional call.
    expect(invocations).toEqual([
      {
        name: 'convert_temperature',
        arguments: { value: 100, from: 'celsius', to: 'fahrenheit' },
        result,
      },
    ]);

    // Unsubscribing stops further notifications.
    unsubscribe();
    await toolByName('convert_temperature').call(0, 'celsius', 'fahrenheit');
    expect(invocations).toHaveLength(1);
  });
});

describe('fetchWeather', () => {
  test('geocodes the city then returns current conditions', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          results: [
            { latitude: 48.85, longitude: 2.35, name: 'Paris', country: 'France' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          current: {
            temperature_2m: 12.3,
            relative_humidity_2m: 70,
            wind_speed_10m: 8,
          },
        }),
      });
    (globalThis as any).fetch = fetchMock;

    const result = JSON.parse(await fetchWeather('Paris'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('geocoding-api');
    expect(fetchMock.mock.calls[1][0]).toContain('latitude=48.85');
    expect(result).toEqual({
      location: 'Paris, France',
      temperatureCelsius: 12.3,
      relativeHumidityPercent: 70,
      windSpeedKmh: 8,
    });
  });

  test('returns an error payload when the city is unknown', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ results: [] }) });

    const result = JSON.parse(await fetchWeather('Nowheresville'));

    expect(result.error).toContain('Nowheresville');
  });

  test('returns a friendly error when the request fails or times out', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down'));

    const result = JSON.parse(await fetchWeather('Paris'));

    expect(result.error).toBe('Impossible to fetch weather info at the moment.');
  });
});

describe('fetchWikipedia', () => {
  test('searches for the article then returns its summary', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          query: { search: [{ title: 'Eiffel Tower' }] },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          title: 'Eiffel Tower',
          description: 'Tower in Paris, France',
          extract: 'The Eiffel Tower is a wrought-iron lattice tower.',
          content_urls: {
            desktop: { page: 'https://en.wikipedia.org/wiki/Eiffel_Tower' },
          },
        }),
      });
    (globalThis as any).fetch = fetchMock;

    const result = JSON.parse(await fetchWikipedia('eiffel tower'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('list=search');
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/page/summary/Eiffel%20Tower',
    );
    expect(result).toEqual({
      title: 'Eiffel Tower',
      description: 'Tower in Paris, France',
      extract: 'The Eiffel Tower is a wrought-iron lattice tower.',
      url: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
    });
  });

  test('returns an error payload when nothing matches', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ query: { search: [] } }) });

    const result = JSON.parse(await fetchWikipedia('asdfqwerzxcv'));

    expect(result.error).toContain('asdfqwerzxcv');
  });

  test('returns a friendly error when the request fails or times out', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down'));

    const result = JSON.parse(await fetchWikipedia('Albert Einstein'));

    expect(result.error).toBe(
      'Impossible to fetch Wikipedia info at the moment.',
    );
  });
});

describe('fetchStockQuote', () => {
  test('resolves the ticker then returns market data with computed change', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          quotes: [
            { symbol: 'AAPL', longname: 'Apple Inc.', marketCap: 3_000_000_000_000 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 195,
                  chartPreviousClose: 190,
                  regularMarketDayHigh: 196,
                  regularMarketDayLow: 192,
                  fiftyTwoWeekHigh: 199,
                  fiftyTwoWeekLow: 164,
                  regularMarketVolume: 50_000_000,
                  currency: 'USD',
                  fullExchangeName: 'NasdaqGS',
                },
              },
            ],
          },
        }),
      });
    (globalThis as any).fetch = fetchMock;

    const result = JSON.parse(await fetchStockQuote('Apple'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/finance/search?q=Apple');
    expect(fetchMock.mock.calls[1][0]).toContain('/finance/chart/AAPL');
    expect(result).toEqual({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NasdaqGS',
      currency: 'USD',
      price: 195,
      previousClose: 190,
      change: 5,
      changePercent: 2.63,
      dayHigh: 196,
      dayLow: 192,
      fiftyTwoWeekHigh: 199,
      fiftyTwoWeekLow: 164,
      volume: 50_000_000,
      marketCap: 3_000_000_000_000,
    });
  });

  test('prefers an equity/ETF over other fuzzy search hits', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          quotes: [
            { symbol: 'AAPL250620C00200000', quoteType: 'OPTION' },
            { symbol: 'AAPL', quoteType: 'EQUITY', longname: 'Apple Inc.' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [{ meta: { regularMarketPrice: 195, currency: 'USD' } }],
          },
        }),
      });
    (globalThis as any).fetch = fetchMock;

    const result = JSON.parse(await fetchStockQuote('Apple'));

    expect(fetchMock.mock.calls[1][0]).toContain('/finance/chart/AAPL');
    expect(result.symbol).toBe('AAPL');
  });

  test('returns an error payload when no ticker matches', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ quotes: [] }) });

    const result = JSON.parse(await fetchStockQuote('asdfqwerzxcv'));

    expect(result.error).toContain('asdfqwerzxcv');
  });

  test('returns a friendly error when the request fails or times out', async () => {
    (globalThis as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down'));

    const result = JSON.parse(await fetchStockQuote('AAPL'));

    expect(result.error).toBe('Impossible to fetch stock info at the moment.');
  });
});
