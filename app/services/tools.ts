import { Tool } from 'react-native-nobodywho';
import { ToolInvocation } from 'types';
import { log } from 'helpers';

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

const API_TIMEOUT_MS = 5_000;

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

// --- Tool definitions ------------------------------------------------------

// Built lazily per chat (not at module load): constructing a Tool starts a
// native polling loop, so we only want live tools for a chat that supports
// tool calling. AiService calls this when `model.toolCalling` is true.
// defineTool wraps each `call` so its invocation is reported live via
// subscribeToolInvocations as the model runs it during ask().
export const buildChatTools = (): Tool[] => [
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

