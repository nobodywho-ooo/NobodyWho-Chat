import { dedupeQueries, verbatimQueryFor } from '../buildSearchQuery';

describe('dedupeQueries', () => {
  it('keeps every arm of a comparison', () => {
    expect(
      dedupeQueries(['bitcoin price today', 'ethereum price today']),
    ).toEqual(['bitcoin price today', 'ethereum price today']);
  });

  it('drops a repeat that differs only by case or diacritics', () => {
    expect(dedupeQueries(['weather Kraków', 'weather Krakow'])).toEqual([
      'weather Kraków',
    ]);
  });

  it('drops blanks', () => {
    expect(dedupeQueries(['  ', 'weather Kraków'])).toEqual(['weather Kraków']);
  });
});

describe('verbatimQueryFor', () => {
  it('offers the question when the plan phrased it differently', () => {
    expect(
      verbatimQueryFor('How far is Zakopane from Krakow?', [
        'distance between Krakow and Zakopane',
      ]),
    ).toBe('How far is Zakopane from Krakow?');
  });

  it('offers nothing when the plan already is the question', () => {
    expect(
      verbatimQueryFor('weather Kraków today', ['weather Kraków today']),
    ).toBeNull();
  });

  it('strips a request opener before deciding it is a duplicate', () => {
    expect(
      verbatimQueryFor('Check weather Kraków', ['weather Kraków']),
    ).toBeNull();
  });
});
