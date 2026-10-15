import { formatTimeControl, parseTimeControl } from './time-control';

describe('parseTimeControl', () => {
  it.each([
    ['5+0', 300, 0],
    ['5+3', 300, 3],
    ['1+0', 60, 0],
    ['10+5', 600, 5],
    ['180+60', 10800, 60],
    [' 3+2 ', 180, 2], // surrounding whitespace is fine
  ])('parses %p', (input, initialSeconds, incrementSeconds) => {
    expect(parseTimeControl(input)).toEqual({
      initialSeconds,
      incrementSeconds,
    });
  });

  it.each([
    '', // empty
    '5', // no increment
    '5+', // missing increment
    '+3', // missing minutes
    '5-3', // wrong separator
    '5 + 3', // spaces inside
    'a+b', // not numbers
    '0+5', // zero minutes
    '181+0', // above the max
    '5+61', // increment above the max
    '1000+0', // too many digits
    '5.5+0', // decimals
  ])('rejects %p', (input) => {
    expect(parseTimeControl(input)).toBeNull();
  });
});

describe('formatTimeControl', () => {
  it('round-trips', () => {
    for (const tc of ['1+0', '3+2', '5+0', '15+10']) {
      expect(formatTimeControl(parseTimeControl(tc)!)).toBe(tc);
    }
  });
});
