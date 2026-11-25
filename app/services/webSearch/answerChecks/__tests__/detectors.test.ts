import {
  answerUsesNoRetrievedEvidence,
  buriesFigureContextOffers,
  claimsMissingEvidenceItHas,
  isWrongLanguageAnswer,
  retryDropsGroundedDetail,
} from '../detectors';

const SKI_CONTEXT =
  'Adult day pass 150.00 EUR, two-day pass 285.00 EUR, season pass 995.00 EUR.';
const STARSHIP_CONTEXT =
  'Starship completed its first fully successful flight. Overnight, from 26 to 27 Aug, SpaceX ran its tenth test flight.';
const RATE_CONTEXT =
  'Euro exchange rate today | Buy EUR 4,3327 | Change of the mid rate';

describe('isWrongLanguageAnswer', () => {
  const question = 'Wer war Karl der Große und was hat er erreicht?';

  it('flags a German question answered in Turkish', () => {
    const answer =
      'Karl der Große, Frankların kralıydı ve 800 yılında imparator oldu. ' +
      'Hukukun düzenlenmesi, okulların kurulması ve büyük inşaat projeleri ' +
      'onun döneminde gerçekleşti.';
    expect(isWrongLanguageAnswer(answer, question)).toBe(true);
  });

  it('does not call an English answer foreign over a single shared word', () => {
    expect(
      isWrongLanguageAnswer(
        'The Eiffel Tower was completed on March 31, 1889.',
        'When was the Eiffel Tower completed',
      ),
    ).toBe(false);
  });

  it('flags an answer whose own language rests on more than one word', () => {
    expect(
      isWrongLanguageAnswer(
        'Das Model 3 kostet in den USA etwa 42.000 Dollar.',
        'How much does a Tesla Model 3 cost',
      ),
    ).toBe(true);
  });

  it('does not flag a genuine answer in the question language', () => {
    expect(
      isWrongLanguageAnswer(
        'Karl der Große war König der Franken und wurde im Jahr 800 zum Kaiser gekrönt. Er förderte Schulen und Klöster.',
        question,
      ),
    ).toBe(false);
  });

  it('does not flag an answer too short or numeric to read a language from', () => {
    expect(isWrongLanguageAnswer('128 zł–181 zł', question)).toBe(false);
  });

  it('does not flag when the question language cannot be detected', () => {
    expect(isWrongLanguageAnswer('This is a genuine answer.', '?')).toBe(false);
  });

  it('does not flag when there is no question to compare against', () => {
    expect(isWrongLanguageAnswer('Some answer.', undefined)).toBe(false);
  });

  it('reads the answer language outside the think block', () => {
    expect(
      isWrongLanguageAnswer(
        '<think>Ich überlege, was die Quellen über den Turm sagen.</think>\n\n' +
          'The Eiffel Tower was completed in 1889 for the World Fair.',
        'When was the Eiffel Tower completed and why was it built?',
      ),
    ).toBe(false);
  });
});

describe('claimsMissingEvidenceItHas', () => {
  it('trusts the planner that the question asks for a price when its words do not say so', () => {
    const question = 'What does a ski pass in Zermatt go for?';
    const refusal = 'The sources give no information about the pass.';
    expect(claimsMissingEvidenceItHas(refusal, question, SKI_CONTEXT)).toBe(
      false,
    );
    expect(
      claimsMissingEvidenceItHas(refusal, question, SKI_CONTEXT, 'price'),
    ).toBe(true);
  });

  it('trusts the planner that the question asks for a date', () => {
    const question = 'Which day was that first successful Starship flight?';
    const refusal =
      'The sources say nothing about the first successful flight.';
    expect(
      claimsMissingEvidenceItHas(refusal, question, STARSHIP_CONTEXT),
    ).toBe(false);
    expect(
      claimsMissingEvidenceItHas(refusal, question, STARSHIP_CONTEXT, 'date'),
    ).toBe(true);
  });

  it('catches a refusal about a rate the context states', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The sources contain no information on the euro exchange rate.',
        'What is the euro exchange rate?',
        RATE_CONTEXT,
      ),
    ).toBe(true);
  });

  it('catches a refusal about a price the context lists', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The sources contain no information about the price.',
        'How much does a ski pass cost?',
        SKI_CONTEXT,
      ),
    ).toBe(true);
  });

  it('catches a refusal about a date the context carries', () => {
    expect(
      claimsMissingEvidenceItHas(
        'According to the sources there is no information about the first fully successful flight.',
        'When did the first fully successful Starship flight happen?',
        STARSHIP_CONTEXT,
      ),
    ).toBe(true);
  });

  it('fires on a refusal in a language no phrase list covers', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Die Quellen enthalten keinen Preis für den Skipass.',
        'Was kostet ein Skipass in Zermatt?',
        SKI_CONTEXT,
        'price',
      ),
    ).toBe(true);
  });

  it('fires on an evasive answer that gives no figure while the page has one', () => {
    expect(
      claimsMissingEvidenceItHas(
        'Pass prices depend on the season and the type of pass, so check the current price list.',
        'How much is a day pass in Zakopane in the 2026/27 season?',
        'Day passes cost from 130 to 200 zł in the 2026/2027 season.',
        'price',
      ),
    ).toBe(true);
  });

  it('fires on a spec answer without a figure while the page states one', () => {
    expect(
      claimsMissingEvidenceItHas(
        'I could not find the specifications of this model.',
        'What refresh rate does the Samsung QE65QN90D have?',
        'Samsung QE65QN90D: refresh rate 144 Hz, Neo QLED panel.',
        'specs',
      ),
    ).toBe(true);
  });

  it('flags the refusal although the model code it repeats carries digits', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The refresh rate of the Samsung QE65QN90D is not given in the sources.',
        'What refresh rate does the Samsung QE65QN90D have?',
        'Resolution 3840 x 2160 Refresh rate 144 Hz Tuner Analogue',
        'specs',
      ),
    ).toBe(true);
  });

  it('does not count a year as the figure the question asked for', () => {
    expect(
      claimsMissingEvidenceItHas(
        'In 2026 the sources do not give the price of the pass.',
        'How much does a ski pass cost?',
        SKI_CONTEXT,
        'price',
      ),
    ).toBe(true);
  });

  it('stays quiet when the answer states a figure', () => {
    expect(
      claimsMissingEvidenceItHas(
        'A pass costs about 150 EUR, depending on the day.',
        'How much does a ski pass cost?',
        SKI_CONTEXT,
        'price',
      ),
    ).toBe(false);
  });

  it('leaves a refusal alone when the block really holds no figure', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The sources give no information about the price of the pass.',
        'How much does a ski pass cost?',
        'Buy your ski pass online. Valid on all lifts in the valley.',
      ),
    ).toBe(false);
  });

  it('does not fire when the question asks for neither a date nor an amount', () => {
    expect(
      claimsMissingEvidenceItHas(
        'The sources contain no information on that.',
        'Who is the CEO of SpaceX?',
        SKI_CONTEXT,
      ),
    ).toBe(false);
  });

  it('needs a context to compare against', () => {
    expect(
      claimsMissingEvidenceItHas('No price is given.', 'How much is it?', ''),
    ).toBe(false);
  });

  it('does not read a Cloudflare ray id as the price asked for', () => {
    const question = 'What is the price of the Samsung Galaxy S26 Ultra?';
    const context =
      '\n --- Source 1: Samsung Galaxy S26 Ultra – price and availability --- \n ' +
      'Just a moment...\nChecking that the connection is secure.\nRay ID: 8f3a9c2b1e4d0000\nPerformance & security by Cloudflare \n' +
      ' --- End of Source 1 ---';
    expect(
      claimsMissingEvidenceItHas(
        'The sources contain no information about the price.',
        question,
        context,
        'price',
      ),
    ).toBe(false);
  });

  it('does not read a bare year as the amount a price question asked for', () => {
    const refusal = 'The sources do not give the ticket price.';
    const question = 'How much is a ticket to Energylandia?';
    expect(
      claimsMissingEvidenceItHas(
        refusal,
        question,
        'Energylandia is open in the 2026 season from April to October.',
        'price',
      ),
    ).toBe(false);
    expect(
      claimsMissingEvidenceItHas(
        refusal,
        question,
        'A one-day ticket to Energylandia costs 219 zl in the 2026 season.',
        'price',
      ),
    ).toBe(true);
  });
});

describe('answerUsesNoRetrievedEvidence', () => {
  const CAMERA_CONTEXT = [
    'The Nikon Coolpix P1100 offers a 125x optical zoom and a 16 MP CMOS sensor.',
    'The Canon PowerShot V1 records 4K 60p video and costs 3499 dollars.',
    'The Sony ZV-1 II remains the pick for vloggers, priced at 2899 dollars.',
    'The ranking also covers the Panasonic Lumix TZ200 and the Fujifilm X100VI.',
  ].join(' ');

  it('fires on a refusal written in a language no phrase list covers', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Ich habe keine Informationen, die den Preis des Samsung Galaxy S25 Ultra betreffen, in den bereitgestellten Quellen gefunden.',
        'How much is the Samsung Galaxy S25 Ultra?',
        CAMERA_CONTEXT,
      ),
    ).toBe(true);
  });

  it('stays quiet when the answer quotes something the sources carry', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'The Canon PowerShot V1 costs 3499 dollars and records 4K 60p.',
        'How much is this camera?',
        CAMERA_CONTEXT,
      ),
    ).toBe(false);
  });

  it('stays quiet when barely anything was retrieved', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Based on the sources provided I cannot determine that right now.',
        'How much is this camera?',
        'The cart is empty.',
      ),
    ).toBe(false);
  });

  it('ignores a one-line reply that was never an answer attempt', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Thank you very much.',
        'Thanks for the help.',
        CAMERA_CONTEXT,
      ),
    ).toBe(false);
  });

  it('does not credit a name the question already carried', () => {
    expect(
      answerUsesNoRetrievedEvidence(
        'Nikon is not described in the sources in a way that allows an answer.',
        'What do you know about Nikon?',
        CAMERA_CONTEXT,
      ),
    ).toBe(true);
  });

  it('does not call an answer evidence-free for want of a figure', () => {
    const context =
      '\n --- Source 1: What is LiDAR? | IBM --- \n What is LiDAR? LiDAR, an ' +
      'acronym for “light detection and ranging,” is a remote-sensing ' +
      'technology that uses laser beams to measure precise distances and ' +
      'movement in an environment, in real time. LiDAR data can be used to ' +
      'generate detailed topographic maps and the dynamic 3D models required ' +
      'to guide an autonomous vehicle. \n --- End of Source 1 ---\n' +
      '\n --- Source 2: Lidar - Wikipedia --- \n distances by measuring the ' +
      'time for a signal to return using appropriate sensors and data ' +
      'acquisition electronics.\nThis page was last edited on 6 September ' +
      '2026, at 18:12 (UTC). \n --- End of Source 2 ---';
    expect(
      answerUsesNoRetrievedEvidence(
        'LIDAR stands for "light detection and ranging."',
        'What does the acronym LIDAR stand for',
        context,
      ),
    ).toBe(false);
  });

  it('does not treat a soft-404 page as evidence the answer ignored', () => {
    const question = 'How much is a ski pass in Zakopane?';
    const context =
      '\n --- Source 1: Ski pass Zakopane - page unavailable --- \n ' +
      '404 - Page not found\nSorry, the page you are looking for does not exist or was removed.\nCheck the URL or go back to the home page. \n' +
      ' --- End of Source 1 ---';
    expect(
      answerUsesNoRetrievedEvidence(
        'The available documents contain no information about the ski pass price in Zakopane.',
        question,
        context,
      ),
    ).toBe(false);
  });
});

describe('buriesFigureContextOffers', () => {
  const question = 'What is the population of Warsaw?';
  const context =
    'On an average day about 2.24 million people stay in Warsaw, far more than its permanent residents. ' +
    'Warsaw, with a population of 1.86 million residents, is the eighth largest city in the European Union.';
  const draft = 'The sources do not give a specific number of residents.';
  const digest =
    'The sources you gave discuss the number of residents in several contexts, but give no single, final figure for your question.\n\n' +
    '* **mazowieckie.example:** This part says that about 2.24 million people stay in Warsaw on an average day. ' +
    'Further on it says that Warsaw, with a population of 1.86 million, is the eighth largest city in the European Union.';

  it('flags the draft that claims no figure is given', () => {
    expect(buriesFigureContextOffers(draft, question, context, 'fact')).toBe(
      true,
    );
  });

  it('flags the retry that buries the figure inside a digest of the sources', () => {
    expect(buriesFigureContextOffers(digest, question, context, 'fact')).toBe(
      true,
    );
  });

  it('passes an answer that leads with the figure', () => {
    expect(
      buriesFigureContextOffers(
        'Warsaw has 1.86 million residents. It is the eighth largest city in the EU.',
        question,
        context,
        'fact',
      ),
    ).toBe(false);
  });

  it('does not apply to a question about a person or with no kind', () => {
    expect(buriesFigureContextOffers(draft, question, context, 'person')).toBe(
      false,
    );
    expect(buriesFigureContextOffers(draft, question, context)).toBe(false);
  });
});

describe('retryDropsGroundedDetail', () => {
  const rich =
    'Fishing rod prices: beginner models cost from 90 EUR to 250 EUR, ' +
    'the mid range is 300-700 EUR, and premium gear starts at 1200 EUR.';

  it('spots a retry that answers in one line and loses the figures', () => {
    expect(
      retryDropsGroundedDetail(rich, 'Rods cost different amounts by model.'),
    ).toBe(true);
  });

  it('accepts a much shorter answer that boils the figures down to a range', () => {
    expect(retryDropsGroundedDetail(rich, 'Rods cost 90 to 1200 EUR.')).toBe(
      false,
    );
  });

  it('accepts a retry that is as long as the first answer', () => {
    expect(
      retryDropsGroundedDetail(
        rich,
        'A beginner rod costs somewhere around a hundred-odd euros, and the ' +
          'higher you go the pricier it gets — several hundred euros in the mid ' +
          'range and a good deal more for premium.',
      ),
    ).toBe(false);
  });

  it('says nothing about an answer that never had figures to lose', () => {
    expect(
      retryDropsGroundedDetail(
        'Photosynthesis turns light into chemical energy.',
        'It turns light into energy.',
      ),
    ).toBe(false);
  });

  it('ignores figures hidden inside a think block', () => {
    expect(
      retryDropsGroundedDetail(
        '<think>90 EUR 250 EUR 700 EUR</think>Rods vary.',
        'It depends on the model.',
      ),
    ).toBe(false);
  });
});
