import { describe, expect, it } from 'vitest';
import { isPointInRadarExclusion, shouldIgnoreSyntheticMouse } from './touchExclusion';

describe('touchExclusion helpers', () => {
  it('excludes touches inside live DOM bounds or fallback bounds while respecting hidden mode', () => {
    // Hidden radar never creates a fixed exclusion rectangle
    expect(
      isPointInRadarExclusion(790, 90, 844, {
        canvas: null,
        width: 112,
        height: 62,
        hidden: true,
      }),
    ).toBe(false);

    // Compact radar via fallback bounds on mobile landscape (844x390)
    expect(
      isPointInRadarExclusion(760, 100, 844, {
        canvas: null,
        width: 112,
        height: 62,
        hidden: false,
      }),
    ).toBe(true);

    // Expanded radar via live DOM canvas rect excludes larger area cleanly
    const expandedRect = {
      left: 600,
      right: 836,
      top: 68,
      bottom: 200,
      width: 236,
      height: 132,
    };
    expect(
      isPointInRadarExclusion(
        610,
        180,
        844,
        { canvas: null, width: 236, height: 132, hidden: false },
        expandedRect,
      ),
    ).toBe(true);

    // Outside expanded radar allows right aim stick
    expect(
      isPointInRadarExclusion(
        560,
        180,
        844,
        { canvas: null, width: 236, height: 132, hidden: false },
        expandedRect,
      ),
    ).toBe(false);
  });

  it('suppresses synthetic mouse events within 600ms of a touch event', () => {
    expect(shouldIgnoreSyntheticMouse(undefined, 1000)).toBe(false);
    expect(shouldIgnoreSyntheticMouse(900, 1050)).toBe(true);
    expect(shouldIgnoreSyntheticMouse(100, 1000)).toBe(false);
  });
});
