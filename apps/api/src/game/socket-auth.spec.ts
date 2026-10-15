import { tokenFromCookieHeader } from './socket-auth';

describe('tokenFromCookieHeader', () => {
  it('returns null when there is no cookie header', () => {
    expect(tokenFromCookieHeader(undefined)).toBeNull();
    expect(tokenFromCookieHeader('')).toBeNull();
  });

  it('returns null when the auth cookie is missing or empty', () => {
    expect(tokenFromCookieHeader('theme=dark; other=1')).toBeNull();
    expect(tokenFromCookieHeader('access_token=')).toBeNull();
  });

  it('extracts the auth cookie among others', () => {
    expect(
      tokenFromCookieHeader('theme=dark; access_token=abc.def.ghi; x=1'),
    ).toBe('abc.def.ghi');
  });
});
