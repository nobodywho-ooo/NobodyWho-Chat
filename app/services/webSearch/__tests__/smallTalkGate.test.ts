import { isSmallTalk } from '../buildSearchQuery';

describe('small talk never reaches the planner', () => {
  it.each(['Thanks, that was helpful.', 'ok', 'Great, thank you', 'hello'])(
    'gates %p',
    text => {
      expect(isSmallTalk(text)).toBe(true);
    },
  );

  it.each([
    'Thanks. And how much is a ski pass?',
    'Ok, when is the next national team match?',
    'Thanks — what is the price of a Falcon 9 launch?',
    'Hey, what is the weather in Zakopane?',
    'Super Bowl when',
    'ok 2026 release date',
    'How much is a ticket?',
    'Who is the CEO of SpaceX?',
    'Thanks for everything you have done so far and tell me one more thing',
  ])('lets %p through to the planner', text => {
    expect(isSmallTalk(text)).toBe(false);
  });

  it('ignores empty input', () => {
    expect(isSmallTalk('')).toBe(false);
    expect(isSmallTalk('   ')).toBe(false);
  });
});
