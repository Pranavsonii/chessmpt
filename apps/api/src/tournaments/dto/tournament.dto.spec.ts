import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTournamentDto, UpdateTournamentDto } from './tournament.dto';

const inHours = (h: number) =>
  new Date(Date.now() + h * 3600_000).toISOString();

function errorsFor(cls: new () => object, body: Record<string, unknown>) {
  return validateSync(plainToInstance(cls, body)).map((e) => e.property);
}

const valid = {
  name: 'Diwali Blitz Cup',
  timeControl: '5+0',
  startsAt: inHours(24),
};

describe('CreateTournamentDto', () => {
  it('accepts a normal tournament', () => {
    expect(errorsFor(CreateTournamentDto, valid)).toEqual([]);
  });

  it.each([
    ['a quote', 'Cup "2026"'],
    ['a bracket', 'Cup ] [White'],
    ['a newline', 'Cup\n[Result "1-0"]'],
    ['angle brackets', '<script>x</script>'],
    ['too short', 'ab'],
  ])('rejects a name with %s', (_label, name) => {
    expect(errorsFor(CreateTournamentDto, { ...valid, name })).toContain(
      'name',
    );
  });

  it('accepts non-English letters and everyday punctuation', () => {
    expect(
      errorsFor(CreateTournamentDto, {
        ...valid,
        name: 'शतरंज Cup: Round #2 (U-14) & more!',
      }),
    ).toEqual([]);
  });

  it('rejects a start time in the past or over a year away', () => {
    expect(
      errorsFor(CreateTournamentDto, { ...valid, startsAt: inHours(-3) }),
    ).toContain('startsAt');
    expect(
      errorsFor(CreateTournamentDto, { ...valid, startsAt: inHours(24 * 400) }),
    ).toContain('startsAt');
  });
});

describe('UpdateTournamentDto', () => {
  it('allows a past start time (an ongoing tournament already started)', () => {
    expect(errorsFor(UpdateTournamentDto, { startsAt: inHours(-48) })).toEqual(
      [],
    );
  });
});
