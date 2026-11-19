import {
  answerStatesFigure,
  contextOffersFigureFor,
  distinctiveEvidence,
  evidenceLinesFor,
} from '../evidence';

describe('distinctiveEvidence', () => {
  it('counts a figure as the same evidence however its language groups it', () => {
    const english = distinctiveEvidence('estimated at 9,188,200 residents');
    const german = distinctiveEvidence('bei 9.188.200 Menschen');
    expect([...english].some(term => german.has(term))).toBe(true);
  });

  it('matches an opening time against the source that writes it with a dot', () => {
    expect(distinctiveEvidence('Opening hours: 10:00-17:00')).toContain('1000');
    expect(distinctiveEvidence('Buka pukul 10.00 sampai 17.00')).toContain(
      '1000',
    );
  });

  it('reads figures written in another numeral system', () => {
    expect(distinctiveEvidence('कीमत १२५ रुपये').has('125')).toBe(true);
  });

  it('does not count sentence-opening words as retrieved names', () => {
    const offered = distinctiveEvidence(
      '404 - Page not found\nSorry, the page you want does not exist.\nCheck the URL.',
    );
    expect(offered.has('sorry')).toBe(false);
    expect(offered.has('check')).toBe(false);
    expect(offered.has('url')).toBe(true);
  });
});

describe('answerStatesFigure', () => {
  const question = 'What refresh rate does the Samsung QE65QN90D have?';

  it('does not credit the model code the refusal repeats from the question', () => {
    expect(
      answerStatesFigure(
        'The refresh rate of the Samsung QE65QN90D is not given in the sources.',
        question,
      ),
    ).toBe(false);
    expect(answerStatesFigure('The new MacBook Air M4 has no price.')).toBe(
      false,
    );
  });

  it('does not credit an identifier run such as an EAN or a product id', () => {
    expect(answerStatesFigure('EAN 8806095414850, product ID 14206893.')).toBe(
      false,
    );
    expect(answerStatesFigure('The population is 1863578 people.')).toBe(true);
  });

  it('credits a figure stated beside the code', () => {
    expect(
      answerStatesFigure('The Samsung QE65QN90D has 144 Hz.', question),
    ).toBe(true);
    expect(answerStatesFigure('Panel 144Hz, 65 inches.')).toBe(true);
  });

  it('does not credit a bare number the question itself carries', () => {
    const asked = 'Give me the price of the iPhone 17 Pro in zloty.';
    expect(
      answerStatesFigure('There is no price for the iPhone 17 Pro.', asked),
    ).toBe(false);
    expect(
      answerStatesFigure('The iPhone 17 Pro costs 5021.9 PLN.', asked),
    ).toBe(true);
  });

  it('keeps a number glued to its unit while dropping hex and mixed codes', () => {
    expect(answerStatesFigure('Panel 144Hz and 4K.')).toBe(true);
    expect(answerStatesFigure('Ray ID: 8f3a9c2b1e4d0000, build v2a4.')).toBe(
      false,
    );
  });
});

describe('evidenceLinesFor', () => {
  const specQuestion = 'What refresh rate does the Samsung QE65QN90D have?';
  const specContext =
    "\n --- Source 1: Samsung QE65QN90D QLED 65'' 4K Ultra HD Tizen TV --- \n " +
    '[Verified product data] name="Samsung QE65QN90D QLED 65\'\' 4K Ultra HD Tizen TV", price=5933.04 PLN, availability=out of stock\n' +
    "Samsung QE65QN90D QLED 65'' 4K Ultra HD Tizen TV Product ID: 14206893 Brand Samsung | Manufacturer code QE65QN90DATXXH | EAN 8806095414850 Refresh rate\n" +
    "Screen diagonal in inches 65'' HD format 4K Ultra HD Resolution 3840 x 2160 Refresh rate 144 Hz Tuner Analogue , DVB-C , DVB-S2 , DVB-T2 (HEVC) HDR technology HDR10+ , HLG Game mode For gamers Smart TV Tizen Wi-Fi Bluetooth HDMI 4 USB 2 Energy class G Weight 25 kg \n" +
    ' --- End of Source 1 ---\n' +
    '\n --- Source 2: Neo QLED Samsung QE65QN90D 65 inch UHD TV --- \n ' +
    "Thanks to Samsung's unique dynamic refresh technology, Motion Xcelerator 144 Hz delivers smooth motion and supports VRR gaming up to 4K 144 Hz. \n" +
    ' --- End of Source 2 ---';

  it('quotes at most three lines and one of them carries the refresh rate', () => {
    const lines = evidenceLinesFor(specQuestion, specContext);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.some(line => line.includes('144 Hz'))).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThan(260);
  });

  it('leads with the spec line clipped to the words around the asked term', () => {
    const [first] = evidenceLinesFor(specQuestion, specContext);
    expect(first).toContain('Refresh rate 144 Hz');
    expect(first).not.toContain('Energy class');
  });

  it('does not quote the line whose only figures are the EAN and the product id', () => {
    const lines = evidenceLinesFor(specQuestion, specContext);
    expect(lines.some(line => line.includes('8806095414850'))).toBe(false);
  });

  it('puts the sentence that answers the population question first', () => {
    const question = 'What is the population of Warsaw?';
    const context =
      '\n --- Source 1: How many people live in Warsaw in 2025? Current data --- \n ' +
      'On an average day about 2.24 million people stay in Warsaw, far more than its permanent residents. ' +
      'Warsaw, with a population of 1.86 million residents, is the eighth largest city in the European Union. \n' +
      ' --- End of Source 1 ---\n' +
      '\n --- Source 2: Population of Warsaw - Wikipedia --- \n ' +
      'Population of Warsaw by district The table shows the population of each district of Warsaw in 2005, 2020 and 2024. \n' +
      ' --- End of Source 2 ---';
    const lines = evidenceLinesFor(question, context);
    expect(lines[0]).toContain('1.86 million');
  });

  it('skips a FAQ question and leads with the forecast sentence', () => {
    const question = 'What will the weather be like in Berlin tomorrow?';
    const context =
      '\n --- Source 1: Weather Berlin — hourly for today, tomorrow and the day after --- \n ' +
      'Weather Berlin hour by hour | every 1 h · 3 days. ' +
      'Today Berlin has 20 degrees and clouds, but pressure is falling; tomorrow the temperature will rise to 26 degrees, still dry. ' +
      'Weather for Berlin in the rain radar app live. ' +
      'Is there a weather forecast for Berlin for 7, 14 or 16 days? ' +
      'Will it rain in Berlin tomorrow (Tuesday)? \n' +
      ' --- End of Source 1 ---';
    const lines = evidenceLinesFor(question, context);
    expect(lines[0]).toContain('26 degrees');
    expect(lines.some(line => line.endsWith('?'))).toBe(false);
  });

  it('finds no figure for a question about a person', () => {
    const question = 'Who is the president of France?';
    const context =
      '\n --- Source 1: President of France - Wikipedia --- \n The President of France is Emmanuel Macron. \n --- End of Source 1 ---';
    expect(evidenceLinesFor(question, context)).toEqual([]);
    expect(contextOffersFigureFor(question, context)).toBe(false);
  });

  it('ignores a context whose only figures are years', () => {
    expect(
      contextOffersFigureFor(
        'What is the capital of Australia?',
        'Canberra has been the capital of Australia since 1913.',
      ),
    ).toBe(false);
  });

  it('does not quote a Cloudflare challenge page', () => {
    const question = 'What is the price of the Samsung Galaxy S26 Ultra?';
    const context =
      '\n --- Source 1: Samsung Galaxy S26 Ultra – price and availability --- \n ' +
      'Just a moment...\nChecking that the connection is secure.\nRay ID: 8f3a9c2b1e4d0000\nPerformance & security by Cloudflare \n' +
      ' --- End of Source 1 ---';
    expect(evidenceLinesFor(question, context)).toEqual([]);
  });
});
