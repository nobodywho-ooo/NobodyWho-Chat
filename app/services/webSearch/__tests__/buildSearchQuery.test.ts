import { WEB_INTENT_KINDS } from '../intentKind';
import {
  toKeywordQuery,
  parseSearchPlan,
  planWebSearch,
  sanitizeSearchQuery,
  extractSiteRestriction,
  carryReferentIntoQuery,
  isAboutTheConversation,
  isConversationalPlan,
  anchorRescueQuery,
} from '../buildSearchQuery';
import { namesATimePeriod } from '../timePeriod';

const history = [
  { role: 'user', content: 'I feel tired, does coffee help or make it worse?' },
  { role: 'assistant', content: 'Coffee can worsen fatigue over time…' },
];

const TODAY = '2026-07-17';

describe('toKeywordQuery', () => {
  it('drops the request wrapper and the quotes around the subject', () => {
    expect(
      toKeywordQuery('Check the offers for the product ‚bathtub’ on olx'),
    ).toBe('the offers for the product bathtub on olx');
    expect(toKeywordQuery('Find the cheapest ticket to Krakow')).toBe(
      'the cheapest ticket to Krakow',
    );
    expect(toKeywordQuery('show me the current bitcoin price')).toBe(
      'the current bitcoin price',
    );
  });

  it('leaves a query that is already keywords alone', () => {
    expect(toKeywordQuery('warsaw weather forecast')).toBe(
      'warsaw weather forecast',
    );
  });

  it('never empties a query that is nothing but a request verb', () => {
    expect(toKeywordQuery('check')).toBe('check');
  });
});

describe('sanitizeSearchQuery', () => {
  it('strips surrounding quotes and label prefixes', () => {
    expect(sanitizeSearchQuery('"green tea daily intake"')).toBe(
      'green tea daily intake',
    );
    expect(sanitizeSearchQuery('Search query: green tea per day')).toBe(
      'green tea per day',
    );
    expect(sanitizeSearchQuery('“how much green tea per day”')).toBe(
      'how much green tea per day',
    );
  });

  it('drops a <think> block and keeps the first real line', () => {
    expect(
      sanitizeSearchQuery(
        '<think>the user means green tea</think>\ngreen tea per day',
      ),
    ).toBe('green tea per day');
    expect(sanitizeSearchQuery('green tea per day\nextra rambling')).toBe(
      'green tea per day',
    );
  });

  it('returns empty for unusable output (blank or too long)', () => {
    expect(sanitizeSearchQuery('')).toBe('');
    expect(sanitizeSearchQuery('   ')).toBe('');
    expect(sanitizeSearchQuery('x'.repeat(200))).toBe('');
  });

  it('eats an unterminated <think> block instead of leaking it as a query', () => {
    expect(
      sanitizeSearchQuery('<think>the user means green tea\ngreen tea per day'),
    ).toBe('');
  });
});

describe('parseSearchPlan', () => {
  it('parses a valid plan', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x y", "queries": ["a b", "c d"]}',
      ),
    ).toEqual({ needsSearch: true, intent: 'x y', queries: ['a b', 'c d'] });
  });

  it('strips a <think> block and extracts the JSON', () => {
    expect(
      parseSearchPlan(
        '<think>hmm the user wants coffee</think>\n{"needs_search": true, "intent": "coffee", "queries": ["coffee per day"]}',
      ),
    ).toEqual({
      needsSearch: true,
      intent: 'coffee',
      queries: ['coffee per day'],
    });
  });

  it('extracts JSON embedded in surrounding prose', () => {
    expect(
      parseSearchPlan(
        'Here is the plan: {"needs_search": false, "intent": "chit chat", "queries": []} done',
      ),
    ).toEqual({ needsSearch: false, intent: 'chit chat', queries: [] });
  });

  it('accepts a single-string queries value', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": "bitcoin price"}',
      )?.queries,
    ).toEqual(['bitcoin price']);
  });

  it('caps queries at the max sub-query count', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": ["a","b","c","d"]}',
      )?.queries,
    ).toEqual(['a', 'b', 'c']);
  });

  it('defaults needsSearch to true when the field is missing', () => {
    expect(
      parseSearchPlan('{"intent": "x", "queries": ["a"]}')?.needsSearch,
    ).toBe(true);
  });

  it('sanitizes quotes/labels and drops empty queries', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "", "queries": ["query: \\"green tea per day\\"", "   "]}',
      )?.queries,
    ).toEqual(['green tea per day']);
  });

  it('returns null when there is no JSON object', () => {
    expect(parseSearchPlan('no json here')).toBeNull();
    expect(parseSearchPlan('')).toBeNull();
  });

  it('reads the plan kind from the closed set, whatever its case', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x", "kind": "Specs", "queries": ["a"]}',
      )?.kind,
    ).toBe('specs');
  });

  it('drops a kind outside the closed set instead of passing it on', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "x", "kind": "shopping", "queries": ["a"]}',
      ),
    ).toEqual({ needsSearch: true, intent: 'x', queries: ['a'] });
  });

  it('never parses deliberation from an unterminated <think> as a plan', () => {
    expect(
      parseSearchPlan(
        '<think>maybe {"needs_search": false, "intent": "x", "queries": []}',
      ),
    ).toBeNull();
  });
});

describe('planWebSearch', () => {
  it('returns no-search for an empty message, without calling the model', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch('   ', [], generate);
    expect(plan).toEqual({ needsSearch: false, intent: '', queries: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('still consults the planner for a concise keyword query', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "bitcoin price", "queries": ["bitcoin price usd today"]}',
      );
    const plan = await planWebSearch('current bitcoin price usd', [], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['bitcoin price usd today']);
  });

  it('searches anyway when the planner waves off a question that names a model code (live: Pixel S1.4)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "general knowledge about TVs", "kind": "chat", "queries": []}',
      );
    const plan = await planWebSearch(
      'What refresh rate does the Samsung QE65QN90D have?',
      [],
      generate,
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual([
      'What refresh rate does the Samsung QE65QN90D have?',
    ]);
  });

  it('keeps trusting the planner’s no-search call when the question carries no code or figure', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "general knowledge", "kind": "chat", "queries": []}',
      );
    const plan = await planWebSearch('why is the sky blue?', [], generate);
    expect(plan.needsSearch).toBe(false);
  });

  it('lets the planner gate a short greeting that is not a search', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "casual greeting", "kind": "chat", "queries": []}',
      );
    const plan = await planWebSearch('hey, how is it going?', [], generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'casual greeting',
      kind: 'chat',
      queries: [],
    });
  });

  it('searches anyway when the plan declines without naming a kind, so an unlabelled refusal cannot silently disable the search', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "casual greeting", "queries": []}',
      );
    const plan = await planWebSearch('hey, how is it going?', [], generate);
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['hey, how is it going?']);
  });

  it('plans a complex question via the LLM and carries context + today', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "coffee daily intake", "queries": ["how much coffee per day is safe"]}',
      );
    const plan = await planWebSearch(
      'how much of it should I drink each day?',
      history,
      generate,
      { today: TODAY },
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: 'coffee daily intake',
      queries: ['how much coffee per day is safe'],
    });
    expect(generate).toHaveBeenCalledTimes(1);
    const messages = generate.mock.calls[0][0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(TODAY);
    expect(messages[1].content).toContain('does coffee help');
    expect(messages[1].content).toContain(
      'how much of it should I drink each day?',
    );
  });

  it('fans out into two sub-queries for a comparison', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "compare phone cameras", "queries": ["iPhone 16 camera review", "Pixel 9 camera review"]}',
      );
    const plan = await planWebSearch(
      'which has a better camera, the iphone 16 or the pixel 9?',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan.queries).toEqual([
      'iPhone 16 camera review',
      'Pixel 9 camera review',
    ]);
  });

  it('fans out into three sub-queries for a three-way comparison', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "compare crypto prices", "queries": ["bitcoin price today", "ethereum price today", "solana price today"]}',
      );
    const plan = await planWebSearch(
      'compare the current prices of Bitcoin, Ethereum and Solana',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan.queries).toEqual([
      'bitcoin price today',
      'ethereum price today',
      'solana price today',
    ]);
  });

  it('honors needs_search=false (no queries)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "write a poem", "kind": "chat", "queries": []}',
      );
    const plan = await planWebSearch(
      'write me a long poem about the sea and the moon',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'write a poem',
      kind: 'chat',
      queries: [],
    });
  });

  it("overrides needs_search=false when the plan's own intent is not one of the conversational categories its prompt defines (live-found Pixel gap — F31)", async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "elon musk children", "queries": []}',
      );
    const plan = await planWebSearch(
      'how many children does Elon Musk have',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['how many children does Elon Musk have']);
  });

  it('overrides needs_search=false for a bare-role follow-up whose intent is still non-conversational (F31)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "president children", "queries": []}',
      );
    const plan = await planWebSearch(
      'list the names of all the children of the president',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual([
      'list the names of all the children of the president',
    ]);
  });

  it('overrides needs_search=false when the model gives no intent at all', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "", "queries": []}',
      );
    const plan = await planWebSearch('euro exchange rate today', [], generate, {
      today: TODAY,
    });
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual(['euro exchange rate today']);
  });

  it('still honors needs_search=false when the intent matches a conversational category', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": false, "intent": "casual greeting", "kind": "chat", "queries": []}',
      );
    const plan = await planWebSearch('hey, how is it going?', [], generate, {
      today: TODAY,
    });
    expect(plan).toEqual({
      needsSearch: false,
      intent: 'casual greeting',
      kind: 'chat',
      queries: [],
    });
  });

  it('falls back to the verbatim message when the model throws', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('no model'));
    const plan = await planWebSearch(
      'what are the long term effects of daily espresso on sleep?',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: '',
      queries: ['what are the long term effects of daily espresso on sleep?'],
    });
  });

  it('clamps a verbatim fallback to a searchable length at a word boundary', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('no model'));
    const message = 'why does my sourdough starter smell like acetone '.repeat(
      8,
    );
    const plan = await planWebSearch(message, [], generate, { today: TODAY });
    const [q] = plan.queries;
    expect(q!.length).toBeLessThanOrEqual(160);
    expect(message.startsWith(q!)).toBe(true);
    expect(q!.endsWith(' ')).toBe(false);
    expect(message[q!.length]).toBe(' ');
  });

  it('falls back to the verbatim message when the output is unparseable', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue('I think you should search for coffee stuff');
    const plan = await planWebSearch(
      'how does caffeine affect deep sleep over the long term?',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan.needsSearch).toBe(true);
    expect(plan.queries).toEqual([
      'how does caffeine affect deep sleep over the long term?',
    ]);
  });

  it('falls back to verbatim (keeping intent) when search is wanted but no query is given', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "coffee health", "queries": []}',
      );
    const plan = await planWebSearch(
      'is drinking a lot of coffee every single day bad for me?',
      [],
      generate,
      { today: TODAY },
    );
    expect(plan).toEqual({
      needsSearch: true,
      intent: 'coffee health',
      queries: ['is drinking a lot of coffee every single day bad for me?'],
    });
  });

  it('only feeds the last N turns and skips empty/system turns', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "green tea", "queries": ["green tea per day"]}',
      );
    const long = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: '' },
      ...Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i}`,
      })),
    ];
    await planWebSearch('how much of it should I drink?', long, generate, {
      today: TODAY,
    });
    const convo = generate.mock.calls[0][0][1].content as string;
    expect(convo).not.toContain('You are helpful.');
    expect(convo).not.toContain('first');
    expect(convo).toContain('turn 9');
  });

  it('prepends the chat digest to the conversation sent to the LLM planner', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "topic", "queries": ["topic query"]}',
      );
    await planWebSearch(
      'and what about the second one?',
      [
        { role: 'user', content: 'compare model A and model B' },
        { role: 'assistant', content: 'Model A is faster.' },
      ],
      generate,
      { today: TODAY, digest: 'Topic: comparing Model A and Model B.' },
    );
    const convo = generate.mock.calls[0][0][1].content as string;
    expect(convo).toContain(
      'Conversation summary so far: Topic: comparing Model A and Model B.',
    );
  });

  describe('example leak guard', () => {
    it("drops a query that echoes the planner's own example entity", async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current Tokyo weather", "queries": ["Tokyo weather today"]}',
        );
      const plan = await planWebSearch(
        'what is the weather today in Warsaw, do I need an umbrella?',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).not.toContain('Tokyo weather today');
    });

    it('falls back to verbatim when every query leaks the example entity', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "sleep tips", "queries": ["Tokyo weather today"]}',
        );
      const plan = await planWebSearch(
        'I feel tired today, could you make me a list of tips for good sleep?',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual([
        toKeywordQuery(
          'I feel tired today, could you make me a list of tips for good sleep?',
        ),
      ]);
    });

    it('keeps a query naming the same entity the planner was given', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current Tokyo weather", "queries": ["Tokyo weather today"]}',
        );
      const plan = await planWebSearch(
        'what is the weather in Tokyo right now?',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual(['Tokyo weather today']);
    });

    it('keeps a currency code the planner adds to a price query', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current bitcoin price", "kind": "price", "queries": ["bitcoin price USD"]}',
        );
      const plan = await planWebSearch(
        'how much is bitcoin right now',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual(['bitcoin price USD']);
    });

    it('drops the example entity written in a script without case', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "current weather", "kind": "fact", "queries": ["दिल्ली मौसम आज"]}',
        );
      const plan = await planWebSearch(
        'what is the weather in Gdańsk',
        [],
        generate,
        {
          today: TODAY,
        },
      );
      expect(plan.queries).not.toContain('दिल्ली मौसम आज');
    });

    it('keeps an unrelated multi-query plan alongside a leaked one', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "weather and concert", "queries": ["Tokyo weather today", "Berlin concert traffic"]}',
        );
      const plan = await planWebSearch(
        'I am driving to a concert in Berlin today, how is the weather and the traffic?',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual(['Berlin concert traffic']);
    });
  });

  describe('site restriction', () => {
    it('extracts a bare domain named in the message', () => {
      expect(
        extractSiteRestriction('Check on the Transfermarkt.pl site who...'),
      ).toBe('transfermarkt.pl');
      expect(
        extractSiteRestriction('search only on wikipedia.org for this'),
      ).toBe('wikipedia.org');
      expect(extractSiteRestriction('check www.espn.com please')).toBe(
        'espn.com',
      );
    });

    it('finds nothing when no domain-shaped token is present', () => {
      expect(extractSiteRestriction('what is the weather today')).toBeNull();
      expect(extractSiteRestriction('release notes v1.2.0')).toBeNull();
      expect(extractSiteRestriction('this is the 2025/26 season.')).toBeNull();
    });

    it('injects a site: operator into the verbatim fallback query', async () => {
      const generate = jest.fn().mockRejectedValue(new Error('no model'));
      const plan = await planWebSearch(
        'check on transfermarkt.pl who scored the most goals',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.siteRestriction).toBe('transfermarkt.pl');
      expect(plan.queries[0]).toContain('site:transfermarkt.pl');
    });

    it('injects a site: operator into every LLM-planned query', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "poland goals", "queries": ["most goals for Poland national team"]}',
        );
      const plan = await planWebSearch(
        'check on transfermarkt.pl who scored the most goals for Poland',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.siteRestriction).toBe('transfermarkt.pl');
      expect(plan.queries).toEqual([
        'most goals for Poland national team site:transfermarkt.pl',
      ]);
    });

    it('does not duplicate the site: operator if the model already added it', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "poland goals", "queries": ["most goals site:transfermarkt.pl"]}',
        );
      const plan = await planWebSearch(
        'check on transfermarkt.pl who scored the most goals',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual(['most goals site:transfermarkt.pl']);
    });

    it('leaves queries and siteRestriction untouched when no site is named', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "bitcoin price", "queries": ["bitcoin price today"]}',
        );
      const plan = await planWebSearch('current bitcoin price', [], generate, {
        today: TODAY,
      });
      expect(plan.siteRestriction).toBeUndefined();
      expect(plan.queries).toEqual(['bitcoin price today']);
    });
  });

  describe('year regrounding', () => {
    it('replaces a stale year the model invented with the injected current year', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Nobel Prize in Literature", "queries": ["Nobel Prize Literature 2023"]}',
        );
      const plan = await planWebSearch(
        'who most recently won the Nobel Prize in Literature?',
        [],
        generate,
        { today: '2026-07-17' },
      );
      expect(plan.queries).toEqual(['Nobel Prize Literature 2026']);
    });

    it('trusts a year the user explicitly asked about', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Oscars 2019 winner", "queries": ["Oscars 2019 best picture"]}',
        );
      const plan = await planWebSearch(
        'who won best picture at the 2019 Oscars?',
        [],
        generate,
        { today: '2026-07-17' },
      );
      expect(plan.queries).toEqual(['Oscars 2019 best picture']);
    });

    it('trusts a year the conversation is about, even when the follow-up omits it', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Oscars 2019 best actor", "queries": ["Oscars 2019 best actor"]}',
        );
      const plan = await planWebSearch(
        'and who won best actor that year?',
        [
          {
            role: 'user',
            content: 'who won best picture at the 2019 Oscars?',
          },
          { role: 'assistant', content: 'Green Book won best picture.' },
        ],
        generate,
        { today: '2026-07-17' },
      );
      expect(plan.queries).toEqual(['Oscars 2019 best actor']);
    });

    it('reads the current year off the ISO date, not the local clock', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "Nobel", "queries": ["Nobel Prize Literature 2023"]}',
        );
      const plan = await planWebSearch(
        'who won the Nobel Prize in Literature?',
        [],
        generate,
        { today: '2026-01-01' },
      );
      expect(plan.queries).toEqual(['Nobel Prize Literature 2026']);
    });

    it('leaves last year alone (reigning-champion framing)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "champion", "queries": ["league champion 2025"]}',
        );
      const plan = await planWebSearch(
        'who is the reigning champion?',
        [],
        generate,
        {
          today: '2026-07-17',
        },
      );
      expect(plan.queries).toEqual(['league champion 2025']);
    });
  });

  describe('language of the planned queries', () => {
    const oledHistory = [
      { role: 'user', content: 'welcher Fernseher mit OLED ist der beste?' },
      {
        role: 'assistant',
        content:
          'Das Modell LG OLED65B65LA ist in der Liste der besten OLED Fernseher 2026.',
      },
    ];
    const question =
      'zähle die Funktionen und technischen Daten auf und sag mir, ob er sich für ein Wohnzimmer mit großen Fenstern eignet';
    const driftedPlan =
      '{"needs_search": true, "intent": "TV features and suitability", "queries": ["best TV for large living room features", "TV technical specifications", "TV suitability for large windows"]}';
    const correctedPlan =
      '{"needs_search": true, "intent": "TV features and suitability", "queries": ["Funktionen und technische Daten LG OLED65B65LA", "OLED Fernseher für Wohnzimmer mit großen Fenstern"]}';

    it('asks the planner again when its queries are not in the language of the conversation (live #341)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValueOnce(driftedPlan)
        .mockResolvedValueOnce(correctedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(generate).toHaveBeenCalledTimes(2);
      const retry = generate.mock.calls[1]![0];
      expect(retry.slice(0, 2)).toEqual(generate.mock.calls[0]![0]);
      expect(retry[2]).toEqual({ role: 'assistant', content: driftedPlan });
      expect(retry[3].role).toBe('user');
      expect(retry[3].content).toMatch(/same language/);
      expect(plan.queries).toEqual([
        'Funktionen und technische Daten LG OLED65B65LA',
        'OLED Fernseher für Wohnzimmer mit großen Fenstern',
      ]);
    });

    it('falls back to the question itself when the retry drifts as well', async () => {
      const generate = jest.fn().mockResolvedValue(driftedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(plan.queries).toEqual([toKeywordQuery(question)]);
    });

    it('replaces a short English follow-up query with the question and keeps it as a fallback (smoke T5)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "TV price", "kind": "price", "queries": ["cost of OLED TV"]}',
        );
      const plan = await planWebSearch(
        'Was kostet er?',
        oledHistory,
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toHaveLength(1);
      expect(plan.queries[0]).toMatch(/kostet/);
      expect(plan.fallbackQueries).toEqual(['cost of OLED TV']);
    });

    it('keeps the drifted queries as a fallback behind the verbatim question', async () => {
      const generate = jest.fn().mockResolvedValue(driftedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(plan.queries).toEqual([toKeywordQuery(question)]);
      expect(plan.fallbackQueries).toHaveLength(3);
      expect(plan.fallbackQueries![0]).toMatch(
        /^best TV for large living room features/,
      );
    });

    it('attaches no fallback when the plan already speaks the conversation language', async () => {
      const generate = jest.fn().mockResolvedValue(correctedPlan);
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(plan.fallbackQueries).toBeUndefined();
    });

    it('keeps the queries that were in the right language when the retry fails', async () => {
      const mixedPlan =
        '{"needs_search": true, "intent": "TV features", "queries": ["technische Daten LG OLED65B65LA", "TV suitability for large windows"]}';
      const generate = jest
        .fn()
        .mockResolvedValueOnce(mixedPlan)
        .mockRejectedValueOnce(new Error('busy'));
      const plan = await planWebSearch(question, oledHistory, generate, {
        today: TODAY,
      });
      expect(plan.queries).toEqual(['technische Daten LG OLED65B65LA']);
    });

    it('carries the topic the user kept returning to into a planner query that dropped it (live #353)', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "cheaper TV", "queries": ["günstigerer Fernseher ähnlich"]}',
        );
      const plan = await planWebSearch(
        'Etwas zu teuer, finde einen günstigeren, der meine Anforderungen erfüllt',
        [
          ...oledHistory,
          {
            role: 'user',
            content:
              'Such nochmal den besten Fernseher für mein Wohnzimmer, nur oled',
          },
          {
            role: 'assistant',
            content:
              'Der beste OLED Fernseher für das Wohnzimmer ist der Samsung QE65S99H für 12 999 zł.',
          },
        ],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual(['günstigerer Fernseher ähnlich OLED']);
    });

    it('does not ask twice when the plan already speaks the language of the conversation', async () => {
      const generate = jest.fn().mockResolvedValue(correctedPlan);
      await planWebSearch(question, oledHistory, generate, { today: TODAY });
      expect(generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('kind of answer the question wants', () => {
    it('carries the planner kind out with the plan', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "TV specs", "kind": "specs", "queries": ["Samsung QE65S99H technical specifications"]}',
        );
      const plan = await planWebSearch(
        'Give me the technical specifications of the Samsung QE65S99H',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.kind).toBe('specs');
    });

    it('keeps the kind when every planned query is thrown out and the question is searched verbatim', async () => {
      const generate = jest
        .fn()
        .mockResolvedValue(
          '{"needs_search": true, "intent": "TV price", "kind": "price", "queries": ["Tokyo weather today"]}',
        );
      const plan = await planWebSearch(
        'how much is the Samsung QE65S99H?',
        [],
        generate,
        { today: TODAY },
      );
      expect(plan.queries).toEqual([
        toKeywordQuery('how much is the Samsung QE65S99H?'),
      ]);
      expect(plan.kind).toBe('price');
    });

    it('tells the planner which kinds exist and shows one per example', async () => {
      const generate = jest.fn().mockResolvedValue('');
      await planWebSearch('how much is the Samsung QE65S99H?', [], generate, {
        today: TODAY,
      });
      const system: string = generate.mock.calls[0]![0][0].content;
      expect(system).toMatch(/"kind": "<kind>"/);
      expect(system).toMatch(/"kind": "price"/);
      expect(system).toMatch(/"kind": "chat"/);
    });
  });
});

describe('anchorRescueQuery', () => {
  it('keeps the model code and the proper noun of a question and adds what the plan expects', () => {
    expect(
      anchorRescueQuery('What refresh rate does the Samsung QE65QN90D have?', [
        'refresh rate',
      ]),
    ).toBe('Samsung QE65QN90D refresh rate');
  });

  it('has nothing to offer for a question without a code or a name', () => {
    expect(anchorRescueQuery('what is the weather today?', [])).toBeNull();
  });
});

describe('extractSiteRestriction', () => {
  it('reads a real site the user names', () => {
    expect(
      extractSiteRestriction('how much is an RTX 4070 on allegro.pl?'),
    ).toBe('allegro.pl');
    expect(
      extractSiteRestriction('How much are Nike Air Max on nike.com?'),
    ).toBe('nike.com');
    expect(extractSiteRestriction('check https://www.otomoto.pl/oferty')).toBe(
      'otomoto.pl',
    );
  });

  it('does not read a library name as a site (live-found: Node.js searched site:node.js)', () => {
    for (const question of [
      'What is the latest version of Node.js?',
      'How do I set up routing in Next.js?',
      'Vue.js vs React comparison',
      'How do I install pandas in main.py?',
    ]) {
      expect(extractSiteRestriction(question)).toBeNull();
    }
  });

  it('finds nothing in a question that names no site at all', () => {
    expect(
      extractSiteRestriction('how much is the Samsung Galaxy S25'),
    ).toBeNull();
  });
});

describe('isAboutTheConversation', () => {
  it('recognises a request to recap the thread (live-found: it triggered a fresh search)', () => {
    for (const question of [
      'Summarise what we discussed',
      'Can you recap what I learned?',
      'To sum up, what did we cover?',
    ]) {
      expect(isAboutTheConversation(question)).toBe(true);
    }
  });

  it('leaves a question about the world alone', () => {
    for (const question of [
      'How much is the Samsung Galaxy S25?',
      'What is the weather in Warsaw today?',
      'What is the latest version of Node.js?',
      'Compare the price of bitcoin and ethereum',
      'Give me the sum of the rainfall in Krakow',
    ]) {
      expect(isAboutTheConversation(question)).toBe(false);
    }
  });

  it('stops the planner asking the web about the conversation', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch(
      'Summarise everything I have learned',
      [],
      generate,
      { rewrite: false },
    );
    expect(plan.needsSearch).toBe(false);
    expect(plan.queries).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('carryReferentIntoQuery', () => {
  const withPresident = [
    { role: 'user', content: 'who is the president of the usa?' },
    {
      role: 'assistant',
      content: 'The president of the USA is currently Donald Trump.',
    },
  ];

  it('splices in the most recently named entity for a bare-role follow-up', () => {
    expect(
      carryReferentIntoQuery(
        'how many children does the president have?',
        withPresident,
      ),
    ).toBe('how many children does the president have? Donald Trump');
  });

  it('keeps a model number that is part of the name, instead of truncating it', () => {
    const aboutPhone = [
      {
        role: 'user',
        content: 'what do you know about the Samsung Galaxy S25',
      },
      { role: 'assistant', content: 'The Samsung Galaxy S25 is a flagship.' },
    ];
    expect(
      carryReferentIntoQuery('and how much does it cost?', aboutPhone),
    ).toBe('and how much does it cost? Samsung Galaxy S25');
  });

  it('does not swallow a standalone number that follows a name', () => {
    const aboutMusk = [
      { role: 'user', content: 'how many children does Elon Musk have' },
      { role: 'assistant', content: 'Elon Musk has 14 children.' },
    ];
    expect(carryReferentIntoQuery('and how old is he?', aboutMusk)).toBe(
      'and how old is he? Elon Musk',
    );
  });

  it('does the same for an English pronoun follow-up', () => {
    const withCeo = [
      { role: 'user', content: 'who is the CEO of Tesla?' },
      { role: 'assistant', content: 'The CEO of Tesla is Elon Musk.' },
    ];
    expect(carryReferentIntoQuery('how many kids does he have?', withCeo)).toBe(
      'how many kids does he have? Elon Musk',
    );
  });

  it('leaves a query alone when it already names someone', () => {
    expect(
      carryReferentIntoQuery(
        'how many children does Donald Trump have?',
        withPresident,
      ),
    ).toBe('how many children does Donald Trump have?');
  });

  it('does not mistake a capital letter mid-word for a proper noun (live-found: "iPhone Air" -> "Phone Air")', () => {
    const comparingPhones = [
      {
        role: 'user',
        content: 'Compare the iPhone 17 Pro and the iPhone Air by weight.',
      },
      {
        role: 'assistant',
        content: '(1) iPhone 17 Pro weight: 206g\n(2) iPhone Air weight: 165g',
      },
    ];
    expect(
      carryReferentIntoQuery(
        'And how much does it cost, the first one?',
        comparingPhones,
      ),
    ).toBe('And how much does it cost, the first one?');
  });

  it('leaves a query alone with no referent marker at all', () => {
    expect(
      carryReferentIntoQuery('what is the price of bitcoin?', withPresident),
    ).toBe('what is the price of bitcoin?');
  });

  it('leaves a query alone when history has no named entity to carry', () => {
    const smallTalk = [
      { role: 'user', content: 'hey, how are you?' },
      { role: 'assistant', content: 'All good, thanks!' },
    ];
    expect(carryReferentIntoQuery('how old is the president?', smallTalk)).toBe(
      'how old is the president?',
    );
  });

  it('does not misfire on a short but self-contained new question that happens to be brief', () => {
    expect(carryReferentIntoQuery('how much is bitcoin?', withPresident)).toBe(
      'how much is bitcoin?',
    );
  });

  it('leaves a digest about a different conversation out of the query (Pixel: coffee brewing bled into a weather search)', () => {
    const weather = [
      { role: 'user', content: 'What is the weather in Warsaw today?' },
      { role: 'assistant', content: 'It is 21 degrees in Warsaw today.' },
    ];
    expect(
      carryReferentIntoQuery(
        'and tomorrow?',
        weather,
        'A conversation about brewing coffee in a moka pot and the grind size.',
      ),
    ).toBe('and tomorrow?');
  });

  it('still carries a digest that summarizes this very conversation', () => {
    const weather = [
      { role: 'user', content: 'What is the weather in Warsaw today?' },
      { role: 'assistant', content: 'It is 21 degrees in Warsaw today.' },
    ];
    expect(
      carryReferentIntoQuery(
        'and tomorrow?',
        weather,
        'A conversation about the weather in Warsaw: 21 degrees today.',
      ),
    ).toBe(
      'and tomorrow? A conversation about the weather in Warsaw: 21 degrees today.',
    );
  });

  it('falls back to the digest for a real comparison with no matchable entity (iPhone 17 Pro vs iPhone Air)', () => {
    const comparingPhones = [
      {
        role: 'user',
        content: 'Compare the iPhone 17 Pro and the iPhone Air by weight.',
      },
      {
        role: 'assistant',
        content: '(1) iPhone 17 Pro weight: 206g\n(2) iPhone Air weight: 165g',
      },
    ];
    expect(
      carryReferentIntoQuery(
        'And how much does it cost, the first one?',
        comparingPhones,
        'Topic: comparing iPhone 17 Pro and iPhone Air by weight.',
      ),
    ).toBe(
      'And how much does it cost, the first one? Topic: comparing iPhone 17 Pro and iPhone Air by weight.',
    );
  });

  it('prefers a matched entity over the digest when both are available', () => {
    expect(
      carryReferentIntoQuery(
        'how many children does the president have?',
        withPresident,
        'Topic: some unrelated digest text.',
      ),
    ).toBe('how many children does the president have? Donald Trump');
  });

  it('leaves the query alone when there is neither an entity nor a digest', () => {
    const smallTalk = [
      { role: 'user', content: 'hey, how are you?' },
      { role: 'assistant', content: 'All good, thanks!' },
    ];
    expect(carryReferentIntoQuery('how old is the president?', smallTalk)).toBe(
      'how old is the president?',
    );
  });

  it('splices the entity into a follow-up that points back with a demonstrative', () => {
    const aboutMetals = [
      { role: 'user', content: 'How much is an ounce of Gold Bullion?' },
      { role: 'assistant', content: 'Gold Bullion costs 1573 USD.' },
    ];
    expect(
      carryReferentIntoQuery(
        'Compare those and give me the results',
        aboutMetals,
      ),
    ).toBe('Compare those and give me the results Gold Bullion');
    expect(
      carryReferentIntoQuery(
        'Who was the top scorer in that game?',
        aboutMetals,
      ),
    ).toBe('Who was the top scorer in that game? Gold Bullion');
  });

  it('does not read a date expression as a demonstrative pointing back', () => {
    const aboutMetals = [
      { role: 'user', content: 'How much is an ounce of Gold Bullion?' },
      { role: 'assistant', content: 'Gold Bullion costs 1573 USD.' },
    ];
    for (const temporal of [
      'What were the most important world events that week?',
      'Which metal gained the most that month?',
      'What were the biggest stories this week?',
    ]) {
      expect(carryReferentIntoQuery(temporal, aboutMetals)).toBe(temporal);
    }
  });

  it('does not carry a capitalized sentence opener glued to the entity (live: "Cena Samsunga Galaxy")', () => {
    const aboutPhone = [
      { role: 'user', content: 'How much is the Samsung Galaxy S25 in Poland' },
      {
        role: 'assistant',
        content: 'Currently Samsung Galaxy S25 costs 3999 zl in Poland.',
      },
    ];
    expect(
      carryReferentIntoQuery('And what camera does it have?', aboutPhone),
    ).toBe('And what camera does it have? Samsung Galaxy S25');
  });

  it('still carries an entity only the assistant ever named', () => {
    expect(carryReferentIntoQuery('and when was he born?', withPresident)).toBe(
      'and when was he born? Donald Trump',
    );
  });

  it('treats "it" as a referent (live-found: two turns searched with no product)', () => {
    const aboutPhone = [
      {
        role: 'user',
        content: 'How much is the Samsung Galaxy S25 in Poland?',
      },
      { role: 'assistant', content: 'The price is 2499 zl.' },
    ];
    expect(
      carryReferentIntoQuery(
        'Is it worth buying now, or should I wait for a sale?',
        aboutPhone,
      ),
    ).toBe(
      'Is it worth buying now, or should I wait for a sale? Samsung Galaxy S25',
    );
    expect(
      carryReferentIntoQuery('Where can I buy it cheapest?', aboutPhone),
    ).toBe('Where can I buy it cheapest? Samsung Galaxy S25');
    expect(carryReferentIntoQuery('How much does it cost?', aboutPhone)).toBe(
      'How much does it cost? Samsung Galaxy S25',
    );
  });

  it('does not fire on a word that merely contains a pronoun', () => {
    const aboutPhone = [
      {
        role: 'user',
        content: 'How much is the Samsung Galaxy S25 in Poland?',
      },
      { role: 'assistant', content: 'The price is 2499 zl.' },
    ];
    for (const selfContained of [
      'What is the weather in Warsaw today?',
      'Is the item still in stock?',
      'Which bank has the best interest rate?',
    ]) {
      expect(carryReferentIntoQuery(selfContained, aboutPhone)).toBe(
        selfContained,
      );
    }
  });

  it('prefers the most recent entity over an earlier one', () => {
    const twoPresidents = [
      { role: 'user', content: 'who is the president of France?' },
      {
        role: 'assistant',
        content: 'The president of France is Emmanuel Macron.',
      },
      { role: 'user', content: 'and who is the president of the USA?' },
      {
        role: 'assistant',
        content: 'The president of the USA is Donald Trump.',
      },
    ];
    expect(
      carryReferentIntoQuery('how old is the president?', twoPresidents),
    ).toBe('how old is the president? Donald Trump');
  });

  it('carries the model the last answer settled on, not the last capitalised run in it (live #349-#351: "Smart TV")', () => {
    const oledChat = [
      {
        role: 'user',
        content: 'Give me the technical specs of the samsung QE65QN90D tv',
      },
      {
        role: 'assistant',
        content:
          'Samsung QE65QN90D has a 120Hz panel and supports HDMI 2.1. Samsung QE65QN90D costs 5999 zł.',
      },
      {
        role: 'user',
        content: 'Search again for the best tv for my living room, only oled',
      },
      {
        role: 'assistant',
        content:
          'The best OLED TV is the Samsung QE65S99H, because its colour palette will delight you. The matte Glare Free screen works well in a living room. The highlighted models offer Smart TV platforms.',
      },
    ];
    expect(carryReferentIntoQuery('What is its price?', oledChat)).toBe(
      'What is its price? Samsung QE65S99H',
    );
  });

  it('is wired end to end through planWebSearch in verbatim mode', async () => {
    const generate = jest.fn();
    const plan = await planWebSearch(
      'how many children does the president have?',
      withPresident,
      generate,
      { rewrite: false },
    );
    expect(generate).not.toHaveBeenCalled();
    expect(plan.queries).toEqual([
      'how many children does the president have? Donald Trump',
    ]);
  });

  it('also carries the referent into a query the LLM planner itself produced (F30 — live-found gap, "how many children does the president have" retrieved Joe Biden pages under a Trump follow-up)', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        needs_search: true,
        intent: "the president's children and wife",
        queries: [
          'how many children does the president have',
          'what is the name of the wife of the president',
        ],
      }),
    );
    const plan = await planWebSearch(
      'how many children does the president have and what is his wife called?',
      withPresident,
      generate,
    );
    expect(plan.queries).toEqual([
      'how many children does the president have Donald Trump',
      'what is the name of the wife of the president Donald Trump',
    ]);
  });

  it('anchors a follow-up on the subject the conversation named, not on the digest text', async () => {
    const comparing = [
      { role: 'user', content: 'Compare Model A and Model B.' },
      { role: 'assistant', content: 'Model A is lighter than Model B.' },
    ];
    const generate = jest.fn();
    const plan = await planWebSearch(
      'how much does it cost, the first one?',
      comparing,
      generate,
      { rewrite: false, digest: 'Topic: comparing Model A and Model B.' },
    );
    expect(plan.queries).toEqual([
      'how much does it cost, the first one? Model A Model B',
    ]);
  });
});

describe('isConversationalPlan', () => {
  it('trusts a no-search plan only when the planner labelled it the chat kind', () => {
    expect(isConversationalPlan({ kind: 'chat' })).toBe(true);
    expect(isConversationalPlan({ kind: 'price' })).toBe(false);
    expect(isConversationalPlan({ kind: 'fact' })).toBe(false);
  });

  it('does not trust an unlabelled plan, whatever its intent text says', () => {
    expect(isConversationalPlan({})).toBe(false);
    expect(isConversationalPlan({ kind: undefined })).toBe(false);
  });

  it('reads the same label in every language the question was asked in, because the label is not the question', () => {
    for (const kind of WEB_INTENT_KINDS) {
      expect(isConversationalPlan({ kind })).toBe(kind === 'chat');
    }
  });
});

describe('the plan says what a complete answer must contain', () => {
  it('keeps up to four short, distinct expectations from the planner', () => {
    expect(
      parseSearchPlan(
        '{"needs_search": true, "intent": "iPhone 17 Pro launch", "kind": "date", "queries": ["iPhone 17 Pro release"], "expects": ["release date", "price in PLN", "Release date", "", 42, "a", "b", "c"]}',
      )?.expects,
    ).toEqual(['release date', 'price in PLN', 'a', 'b']);
  });

  it('records no expectations when the planner gives none', () => {
    expect(
      parseSearchPlan('{"needs_search": true, "intent": "x", "queries": ["x"]}')
        ?.expects,
    ).toBeUndefined();
  });

  it('carries the expectations through planning and drops one copied from the examples', async () => {
    const generate = jest
      .fn()
      .mockResolvedValue(
        '{"needs_search": true, "intent": "iPhone 17 Pro launch", "kind": "date", "queries": ["iPhone 17 Pro release"], "expects": ["release date", "Tokyo weather"]}',
      );
    const plan = await planWebSearch(
      'when is the iPhone 17 Pro release?',
      [],
      generate,
    );
    expect(plan.expects).toEqual(['release date']);
  });
});

describe('namesATimePeriod', () => {
  it('reads a year as the period the question is about', () => {
    expect(namesATimePeriod('What was the price of gold in 2024?')).toBe(true);
    expect(namesATimePeriod('Who won the 1998 World Cup?')).toBe(true);
  });

  it('reads a century written in roman numerals, whatever the language', () => {
    expect(
      namesATimePeriod('Which US presidents served in the XIX century?'),
    ).toBe(true);
    expect(namesATimePeriod('Papi del XX secolo')).toBe(true);
    expect(namesATimePeriod('Reyes de España del siglo XVIII')).toBe(true);
  });

  it('treats a question that names no period as being about the present', () => {
    expect(namesATimePeriod('Who is the president of the USA?')).toBe(false);
    expect(namesATimePeriod('Wer ist Bundeskanzler?')).toBe(false);
    expect(namesATimePeriod('現在の日本の首相は誰ですか')).toBe(false);
    expect(namesATimePeriod('भारत के प्रधानमंत्री कौन हैं')).toBe(false);
  });

  it('does not read an acronym as a roman numeral', () => {
    expect(namesATimePeriod('How much is a DVD?')).toBe(false);
    expect(namesATimePeriod('What does LLC mean?')).toBe(false);
    expect(namesATimePeriod('Who was Mieszko I?')).toBe(false);
  });
});
