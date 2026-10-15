import { outcomeFor } from './outcome';

describe('outcomeFor', () => {
  it.each([
    ['1-0', 'white', 'win'],
    ['1-0', 'black', 'loss'],
    ['0-1', 'white', 'loss'],
    ['0-1', 'black', 'win'],
    ['1/2-1/2', 'white', 'draw'],
    ['1/2-1/2', 'black', 'draw'],
  ] as const)('%s as %s is a %s', (result, color, expected) => {
    expect(outcomeFor(result, color)).toBe(expected);
  });
});
