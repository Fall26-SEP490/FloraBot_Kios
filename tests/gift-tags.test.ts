import { describe, expect, it } from 'vitest';
import { matchesGiftTags } from '../apps/kiosk/src/gift-tags';
describe('gift tag filtering', () => {
  it('requires every selected seller tag', () => {
    const preferences = { flower: 'rose', color: 'pink', material: 'wax' };
    expect(matchesGiftTags(['flower:rose', 'color:pink', 'material:wax'], preferences)).toBe(true);
    expect(matchesGiftTags(['flower:rose', 'color:red', 'material:wax'], preferences)).toBe(false);
    expect(matchesGiftTags(undefined, preferences)).toBe(false);
  });
  it('allows unspecified groups without matching prose or other groups', () => {
    expect(matchesGiftTags(undefined, { flower: '', color: '', material: '' })).toBe(true);
    expect(matchesGiftTags(['material:other'], { flower: 'other', color: '', material: '' })).toBe(
      false,
    );
    expect(matchesGiftTags(['flower:rose'], { flower: 'rose', color: '', material: '' })).toBe(
      true,
    );
  });
});
