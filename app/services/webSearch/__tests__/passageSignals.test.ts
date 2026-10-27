import { DATE_IN_TEXT, quotesPrices } from '../passageSignals';

describe('DATE_IN_TEXT reads a date as notation, not as a month name', () => {
  const DATES: [string, string][] = [
    ['ISO', 'Updated 2025-08-27 in the morning.'],
    ['day-first numeric', 'The premiere took place on 27.08.2025 in Warsaw.'],
    ['slashes', 'The launch slipped to 27/08/2025 after a scrub.'],
    ['English month name', 'The flight took place on 27 August 2025.'],
    ['English month first', 'Released September 15, 2026 worldwide.'],
    ['German', 'Der Erstflug fand am 27. August 2025 statt.'],
    ['Spanish', 'El vuelo se realizo el 27 de agosto de 2025.'],
    ['French', 'Le vol a eu lieu le 27 aout 2025 depuis la base.'],
    ['Turkish', 'Ilk ucus 27 Agustos 2025 tarihinde gerceklesti.'],
    ['Portuguese', 'O voo aconteceu em 27 de agosto de 2025.'],
    ['Indonesian', 'Penerbangan itu terjadi pada 27 Agustus 2025.'],
    ['Japanese', '初飛行は2025年8月27日に行われた。'],
    ['Chinese', '首飞于2025年8月27日进行。'],
    ['Hindi', 'यह उड़ान 27 अगस्त 2025 को हुई।'],
    ['Russian', 'Полет состоялся 27 августа 2025 года.'],
    ['Arabic', 'حدثت الرحلة في 27 أغسطس 2025.'],
  ];

  it.each(DATES)('reads a %s date', (_label, text) => {
    expect(DATE_IN_TEXT.test(text)).toBe(true);
  });

  const NOT_DATES: [string, string][] = [
    ['a bare year', 'The census of 1931 counted 219,000 residents.'],
    ['a time of day', 'The shop is open from 10:00 to 18:00.'],
    ['a product number', 'The GTX1660 card supports this mode.'],
    ['a price', 'The price is 5299 dollars per unit.'],
    ['a measurement run', 'They measured 27 8 2025 pieces in three runs.'],
  ];

  it.each(NOT_DATES)('does not read %s as a date', (_label, text) => {
    expect(DATE_IN_TEXT.test(text)).toBe(false);
  });

  it('answers the same on a second call, having no lastIndex to carry', () => {
    const text = 'Premiere 27.08.2025.';
    expect(DATE_IN_TEXT.test(text)).toBe(DATE_IN_TEXT.test(text));
  });
});

describe('quotesPrices reads the shape of the page, not the words of the question', () => {
  const priceTable = [
    '1 day - adult | 150,00 PLN',
    '1 day - reduced | 140,00 PLN',
    '2 days - adult | 285,00 PLN',
    'The pass covers every lift in the region.',
  ].join('\n');

  const prose = [
    'It doubled between 1100 and 1300 from 5,000 to 10,000 inhabitants.',
    'By the early 17th century the population had reached 28,000.',
    'Krakow is a city in southern Poland with a long history of trade.',
  ].join('\n');

  it('holds for a table of amounts', () => {
    expect(quotesPrices(priceTable)).toBe(true);
  });

  it('holds for an article that ends in the amounts it was written about', () => {
    expect(
      quotesPrices(
        [
          'How much is the iPhone 17 Pro in the US? The topic comes back every year.',
          'We check how much the iPhone 17 Pro costs in the US this month.',
          'iPhone 17 Pro 256 GB is 1099 dollars.',
          'iPhone 17 Pro 512 GB is 1299 dollars.',
        ].join('\n'),
      ),
    ).toBe(true);
  });

  it('holds for an amount written in a currency symbol alone', () => {
    expect(
      quotesPrices(
        [
          'Il televisore offre quanto di meglio la tecnologia possa dare.',
          'Ogni film costa poco in emozioni e molto in qualita.',
          'Prezzo € 2.499,00',
        ].join('\n'),
      ),
    ).toBe(true);
  });

  it('does not hold for a page of figures that are not amounts', () => {
    expect(quotesPrices(prose)).toBe(false);
  });

  it('does not hold for an empty page', () => {
    expect(quotesPrices('')).toBe(false);
  });
});
