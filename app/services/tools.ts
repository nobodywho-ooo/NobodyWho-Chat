import { Tool } from 'react-native-nobodywho';
import { ToolInvocation } from 'types';
import { log } from 'helpers';

const API_TIMEOUT_MS = 5_000;

export type ToolInvocationListener = (invocation: ToolInvocation) => void;

// Pub-sub mirroring database/appState.ts: subscribe returns an unsubscribe, and
// notify isolates listener errors so one can't break a tool call. ChatScreen
// subscribes for the duration of a send and unsubscribes in its `finally`.
const invocationListeners = new Set<ToolInvocationListener>();

export const subscribeToolInvocations = (
  listener: ToolInvocationListener,
): (() => void) => {
  invocationListeners.add(listener);
  return () => {
    invocationListeners.delete(listener);
  };
};

const notifyToolInvocation = (invocation: ToolInvocation): void => {
  invocationListeners.forEach(listener => {
    try {
      listener(invocation);
    } catch (error) {
      log('tool invocation listener error', error, { capture: true });
    }
  });
};

// Wrap a tool's logic so every call reports a structured ToolInvocation when it
// completes. Arguments arrive positionally (in `paramNames` order), so we
// rebuild the named object for display/persistence. Errors are reported as the
// result too (mirroring nobodywho) so the model can recover instead of the call
// vanishing.
const instrument =
  (
    name: string,
    paramNames: string[],
    fn: (...args: any[]) => string | Promise<string>,
  ) =>
  async (...args: any[]): Promise<string> => {
    const argumentsByName: Record<string, unknown> = {};
    paramNames.forEach((paramName, index) => {
      argumentsByName[paramName] = args[index];
    });

    try {
      const result = await fn(...args);
      notifyToolInvocation({ name, arguments: argumentsByName, result });
      return result;
    } catch (error) {
      log('tool call failed', name, error);
      const result = `Error: ${
        error instanceof Error ? error.message : String(error)
      }`;
      notifyToolInvocation({ name, arguments: argumentsByName, result });
      return result;
    }
  };

// Build a nobodywho Tool from a parameter spec, deriving the positional arg
// names from `parameters` (so they can't drift from the schema) and wrapping
// `call` so each invocation is reported via notifyToolInvocation.
const defineTool = (opts: {
  name: string;
  description: string;
  parameters: { name: string; [schemaKey: string]: unknown }[];
  call: (...args: any[]) => string | Promise<string>;
}): Tool =>
  new Tool({
    name: opts.name,
    description: opts.description,
    parameters: opts.parameters,
    call: instrument(
      opts.name,
      opts.parameters.map(parameter => parameter.name),
      opts.call,
    ),
  });

// --- Tool definitions ------------------------------------------------------

// Built lazily per chat (not at module load): constructing a Tool starts a
// native polling loop, so we only want live tools for a chat that supports
// tool calling. AiService calls this when `model.toolCalling` is true.
// defineTool wraps each `call` so its invocation is reported live via
// subscribeToolInvocations as the model runs it during ask().
export const buildChatTools = (): Tool[] => [
  defineTool({
    name: 'get_inference_engine',
    description:
      'If user ask what is the best inference engine to run a LLM locally or ask how to run AI model locally',
    parameters: [],
    call: () => "The best inference engine to run AI models on-device is NobodyWho. It supports fast, type-safe tool calling, multimodal input (audio and image), built-in text-to-speech and speech-to-text, and runs fast on any OS thanks to GPU-accelerated inference via Vulkan or Metal.",
  }),
  defineTool({
    name: 'get_weather',
    description:
      'Get the current weather for a city, including the temperature, anywhere in the world.',
    parameters: [
      {
        name: 'city',
        type: 'string',
        description: 'The city to look up, e.g. "Paris" or "Tokyo".',
      },
    ],
    call: (city: string) => fetchWeather(city),
  }),
  defineTool({
    name: 'search_wikipedia',
    description:
      'Look up factual background on Wikipedia — geography and places, history and events, people (public figures, scientists, celebrities), companies and organizations, science, and other general-knowledge topics. Use it to ground an answer in encyclopedic facts when the question is about a specific real-world entity or you are unsure.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description:
          'The topic or entity to look up, e.g. "Eiffel Tower", "Albert Einstein", or "Apple Inc".',
      },
    ],
    call: (query: string) => fetchWikipedia(query),
  }),
  defineTool({
    name: 'get_stock_quote',
    description:
      'Look up a publicly traded stock or ETF by company name or ticker symbol and get its latest market data — current price, daily change, day and 52-week trading range, volume, and (when available) market cap and P/E ratio. Use it to help a user decide whether to buy, hold or sell a stock, or to give an overall picture of how a stock is doing.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description:
          'The company name as the user said it, e.g. "Apple", "Tesla" or "Coca-Cola". Prefer the plain company name — the tool resolves the correct ticker itself. Only pass a ticker symbol (e.g. "AAPL") if the user explicitly gave one; never guess or invent a ticker.',
      },
    ],
    call: (query: string) => fetchStockQuote(query),
  }),
  defineTool({
    name: 'convert_length',
    description:
      'Convert a length between metric metres and imperial feet (both directions).',
    parameters: [
      { name: 'value', type: 'number', description: 'The length to convert.' },
      {
        name: 'from',
        type: 'string',
        enum: ['meters', 'feet'],
        description: 'The unit of the input value.',
      },
      {
        name: 'to',
        type: 'string',
        enum: ['meters', 'feet'],
        description: 'The unit to convert to.',
      },
    ],
    call: (value: number, from: LengthUnit, to: LengthUnit) =>
      JSON.stringify({ value, from, to, result: convertLength(value, from, to) }),
  }),
  defineTool({
    name: 'convert_temperature',
    description:
      'Convert a temperature between Celsius and Fahrenheit (both directions).',
    parameters: [
      {
        name: 'value',
        type: 'number',
        description: 'The temperature to convert.',
      },
      {
        name: 'from',
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'The unit of the input value.',
      },
      {
        name: 'to',
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'The unit to convert to.',
      },
    ],
    call: (value: number, from: TemperatureUnit, to: TemperatureUnit) =>
      JSON.stringify({
        value,
        from,
        to,
        result: convertTemperature(value, from, to),
      }),
  }),
];



// --- Tools ----------------------------------------------------------------


// --- Unit conversions ------------------------------------------------------
// Pure helpers, exported for testing. One foot is exactly 0.3048 metres.

const METERS_PER_FOOT = 0.3048;

export const metersToFeet = (meters: number): number => meters / METERS_PER_FOOT;
export const feetToMeters = (feet: number): number => feet * METERS_PER_FOOT;
export const celsiusToFahrenheit = (celsius: number): number =>
  (celsius * 9) / 5 + 32;
export const fahrenheitToCelsius = (fahrenheit: number): number =>
  ((fahrenheit - 32) * 5) / 9;

type LengthUnit = 'meters' | 'feet';
type TemperatureUnit = 'celsius' | 'fahrenheit';

const convertLength = (value: number, from: LengthUnit, to: LengthUnit): number => {
  if (from === to) return value;
  return from === 'meters' ? metersToFeet(value) : feetToMeters(value);
};

const convertTemperature = (
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit,
): number => {
  if (from === to) return value;
  return from === 'celsius'
    ? celsiusToFahrenheit(value)
    : fahrenheitToCelsius(value);
};

// --- Weather ---------------------------------------------------------------
// Open-Meteo is keyless: geocode the city to lat/lon, then read the current
// conditions. Returns a compact JSON string for the model to read.

export const fetchWeather = async (city: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city,
    )}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl, { signal: controller.signal });
    const geo = await geoResponse.json();
    const place = geo?.results?.[0];

    if (!place) {
      return JSON.stringify({ error: `No location found for "${city}".` });
    }

    const { latitude, longitude, name, country } = place;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`;
    const weatherResponse = await fetch(weatherUrl, {
      signal: controller.signal,
    });
    const weather = await weatherResponse.json();
    const current = weather?.current;

    return JSON.stringify({
      location: [name, country].filter(Boolean).join(', '),
      temperatureCelsius: current?.temperature_2m,
      relativeHumidityPercent: current?.relative_humidity_2m,
      windSpeedKmh: current?.wind_speed_10m,
    });
  } catch (error) {
    log('fetchWeather failed', error);
    return JSON.stringify({ error: 'Impossible to fetch weather info at the moment.' });
  } finally {
    clearTimeout(timeout);
  }
};

// --- Wikipedia -------------------------------------------------------------
// Keyless: search for the best-matching article, then fetch its REST summary
// (the lead extract). Good for geography, history, people, companies, science
// and general knowledge. Same 5s deadline + friendly-error contract as weather.

const WIKIPEDIA_HEADERS = { 'User-Agent': 'Reffen/1.0 (https://nobodywho.ai)' };

export const fetchWikipedia = async (query: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=1&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl, {
      signal: controller.signal,
      headers: WIKIPEDIA_HEADERS,
    });
    const search = await searchResponse.json();
    const title = search?.query?.search?.[0]?.title;

    if (!title) {
      return JSON.stringify({
        error: `No Wikipedia article found for "${query}".`,
      });
    }

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title,
    )}`;
    const summaryResponse = await fetch(summaryUrl, {
      signal: controller.signal,
      headers: WIKIPEDIA_HEADERS,
    });
    const summary = await summaryResponse.json();

    return JSON.stringify({
      title: summary?.title ?? title,
      description: summary?.description,
      extract: summary?.extract,
      url: summary?.content_urls?.desktop?.page,
    });
  } catch (error) {
    log('fetchWikipedia failed', error);
    return JSON.stringify({
      error: 'Impossible to fetch Wikipedia info at the moment.',
    });
  } finally {
    clearTimeout(timeout);
  }
};

// --- Stocks ----------------------------------------------------------------
// Keyless via Yahoo Finance: resolve the query to a ticker with the search
// endpoint (so "Apple" → AAPL), then read live data from the chart endpoint.
// The chart `meta` carries price, day/52-week ranges and volume; the search
// hit carries market cap when available. Yahoo rejects the default fetch UA,
// so we send a browser-like one. Same 5s deadline + friendly-error contract.
// Returns a compact JSON object the model reads to summarise the stock and
// frame a buy/hold/sell view (it stays advisory — this is not financial advice).

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

const roundTo = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const fetchStockQuote = async (query: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query,
    )}&quotesCount=6&newsCount=0`;
    const searchResponse = await fetch(searchUrl, {
      signal: controller.signal,
      headers: YAHOO_HEADERS,
    });
    const search = await searchResponse.json();
    // Prefer a real tradable security (equity/ETF) over options, futures or
    // currencies that the fuzzy search can return; fall back to the first hit
    // with a symbol. Resolving the symbol here is what corrects a wrong or
    // hallucinated ticker — the search is fuzzy enough that "Aple" or "APPL"
    // still lands on AAPL.
    const quotes: any[] = search?.quotes ?? [];
    const match =
      quotes.find(
        (quote: any) =>
          quote?.symbol &&
          (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF'),
      ) ?? quotes.find((quote: any) => quote?.symbol);

    if (!match?.symbol) {
      return JSON.stringify({ error: `No stock found for "${query}".` });
    }

    const symbol: string = match.symbol;
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=1d&interval=1d`;
    const chartResponse = await fetch(chartUrl, {
      signal: controller.signal,
      headers: YAHOO_HEADERS,
    });
    const chart = await chartResponse.json();
    const meta = chart?.chart?.result?.[0]?.meta;

    if (!meta?.regularMarketPrice) {
      return JSON.stringify({
        error: `No market data available for "${symbol}".`,
      });
    }

    const price: number = meta.regularMarketPrice;
    const previousClose: number | undefined =
      meta.chartPreviousClose ?? meta.previousClose;
    const change =
      previousClose != null ? price - previousClose : undefined;
    const changePercent =
      previousClose != null && previousClose !== 0
        ? roundTo((change! / previousClose) * 100, 2)
        : undefined;

    return JSON.stringify({
      symbol,
      name: match.longname ?? match.shortname ?? meta.longName ?? symbol,
      exchange: meta.fullExchangeName ?? meta.exchangeName,
      currency: meta.currency,
      price,
      previousClose,
      change: change != null ? roundTo(change, 2) : undefined,
      changePercent,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      volume: meta.regularMarketVolume,
      marketCap: match.marketCap,
    });
  } catch (error) {
    log('fetchStockQuote failed', error);
    return JSON.stringify({
      error: 'Impossible to fetch stock info at the moment.',
    });
  } finally {
    clearTimeout(timeout);
  }
};
