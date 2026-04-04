import { avatarColor } from '@/utils/avatarColor';

describe('avatarColor', () => {
  it('returns a valid hex color string', () => {
    expect(avatarColor('user123')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('is deterministic for the same uid', () => {
    expect(avatarColor('abc')).toBe(avatarColor('abc'));
    expect(avatarColor('hello-world')).toBe(avatarColor('hello-world'));
  });

  it('returns different colors for different uids', () => {
    const uids = ['uid1', 'uid2', 'uid3', 'uid4', 'uid5'];
    const colors = uids.map(avatarColor);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('handles empty string without throwing', () => {
    expect(() => avatarColor('')).not.toThrow();
    expect(avatarColor('')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles a single character uid', () => {
    expect(avatarColor('a')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles a long uid', () => {
    const long = 'a'.repeat(100);
    expect(avatarColor(long)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('produces different colors for anagrams', () => {
    expect(avatarColor('abc')).not.toBe(avatarColor('cba'));
  });
});
