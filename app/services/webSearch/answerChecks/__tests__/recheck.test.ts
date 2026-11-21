import { planAnswerRecheck } from '../recheck';

const SKI_CONTEXT =
  '\n --- Source 1: Zermatt ski passes 2026 --- \n ' +
  'Adult day pass 150.00 EUR, two-day pass 285.00 EUR, season pass 995.00 EUR. \n' +
  ' --- End of Source 1 ---';
const SKI_QUESTION = 'How much does a day pass in Zermatt cost?';

describe('planAnswerRecheck', () => {
  it('leaves a grounded answer alone', () => {
    expect(
      planAnswerRecheck('An adult day pass costs 150.00 EUR.', {
        question: SKI_QUESTION,
        context: SKI_CONTEXT,
        intentKind: 'price',
      }),
    ).toBeNull();
  });

  it('does nothing without sources or without an answer', () => {
    const refusal = 'The sources give no price for the pass.';
    expect(
      planAnswerRecheck(refusal, { question: SKI_QUESTION, context: '' }),
    ).toBeNull();
    expect(
      planAnswerRecheck('<think>hmm</think>', {
        question: SKI_QUESTION,
        context: SKI_CONTEXT,
      }),
    ).toBeNull();
  });

  it('asks a wrong-language answer again in the conversation, anchored to the question language', () => {
    const recheck = planAnswerRecheck(
      'Der Tagespass kostet für Erwachsene 150 Euro und der Saisonpass 995 Euro.',
      { question: SKI_QUESTION, context: SKI_CONTEXT, intentKind: 'price' },
    )!;
    expect(recheck.reason).toBe('wrongLanguage');
    expect(recheck.continuesConversation).toBe(true);
    expect(recheck.prompt).toContain('wrong language');
    expect(recheck.prompt).toMatch(/\(Answer in English\.\)$/);
    expect(recheck.accepts('An adult day pass costs 150 EUR.')).toBe(true);
    expect(
      recheck.accepts(
        'Der Tagespass kostet 150 Euro, das ist der Preis für Erwachsene.',
      ),
    ).toBe(false);
  });

  it('quotes the evidence lines when the answer says the sources are silent', () => {
    const recheck = planAnswerRecheck(
      'The sources contain no information about the price of a day pass.',
      { question: SKI_QUESTION, context: SKI_CONTEXT, intentKind: 'price' },
    )!;
    expect(recheck.reason).toBe('missingEvidence');
    expect(recheck.continuesConversation).toBe(false);
    expect(recheck.prompt).toContain('"Adult day pass 150.00 EUR');
    expect(recheck.prompt).toContain(`Question: ${SKI_QUESTION}`);
    expect(recheck.accepts('An adult day pass costs 150.00 EUR.')).toBe(true);
    expect(recheck.accepts('The sources do not state a price.')).toBe(false);
    expect(recheck.accepts('')).toBe(false);
  });

  it('nudges an answer that leads without the figure the sources offer', () => {
    const question = 'What is the population of Warsaw?';
    const context =
      '\n --- Source 1: Warsaw in numbers --- \n ' +
      'Warsaw, with a population of 1.86 million residents, is the eighth largest city in the European Union. \n' +
      ' --- End of Source 1 ---';
    const recheck = planAnswerRecheck(
      'Warsaw is the capital and largest city of the country. It has about 1.86 million residents.',
      { question, context, intentKind: 'fact' },
    )!;
    expect(recheck.reason).toBe('buriesFigure');
    expect(recheck.accepts('Warsaw has 1.86 million residents.')).toBe(true);
  });

  it('nudges an answer that uses none of the evidence retrieved', () => {
    const question = 'Tell me about the Canon PowerShot V1.';
    const context =
      '\n --- Source 1: Compact cameras 2026 --- \n ' +
      'The Nikon Coolpix P1100 offers a 125x optical zoom and a 16 MP sensor. ' +
      'The Canon PowerShot V1 records 4K 60p video and costs 3499 dollars. ' +
      'The Sony ZV-1 II remains the pick for vloggers, priced at 2899 dollars. \n' +
      ' --- End of Source 1 ---';
    const recheck = planAnswerRecheck(
      'Compact cameras differ a lot, so it is best to compare them in a shop before buying.',
      { question, context },
    )!;
    expect(recheck.reason).toBe('ignoresEvidence');
    expect(recheck.accepts('The Canon PowerShot V1 costs 3499 dollars.')).toBe(
      true,
    );
  });

  it('keeps the first answer when the retry drops its figures and shrinks', () => {
    const question = 'How much do fishing rods cost?';
    const context =
      '\n --- Source 1: Fishing rod buying guide --- \n ' +
      'Beginner models cost from 90 EUR to 250 EUR, the mid range is 300-700 EUR, and premium gear starts at 1200 EUR. \n' +
      ' --- End of Source 1 ---';
    const draft =
      'There are many fishing rods. Beginner models from 90 EUR to 250 EUR, mid range 300-700 EUR, premium from 1200 EUR.';
    const recheck = planAnswerRecheck(draft, {
      question,
      context,
      intentKind: 'price',
    })!;
    expect(recheck.reason).toBe('buriesFigure');
    expect(recheck.accepts('Rods cost from 90 EUR up.')).toBe(true);
    expect(recheck.accepts('Fishing rods cost 15 EUR.')).toBe(false);
  });
});
