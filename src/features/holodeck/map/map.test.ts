import { describe, expect, it } from 'vitest';
import { generateHolodeckAlphaData } from './holodeckAlpha';
import { isPointInsideZone } from './mapColliders';

describe('Holodeck Alpha Map Generation', () => {
  it('generates 3-lane map data with colliders and plant zones', () => {
    const data = generateHolodeckAlphaData();

    expect(data.blocks.length).toBeGreaterThan(15);
    expect(data.colliders.length).toBe(data.blocks.length);
    expect(data.plantZones.length).toBe(2);
    expect(data.spawns.length).toBe(10); // 5 blue, 5 red

    const siteA = data.plantZones.find((z) => z.site === 'A');
    const siteB = data.plantZones.find((z) => z.site === 'B');
    expect(siteA).toBeDefined();
    expect(siteB).toBeDefined();

    // Verify Site A plant detection
    const insideA = isPointInsideZone([35, 1, -20], siteA!);
    const outsideA = isPointInsideZone([0, 1, 0], siteA!);
    expect(insideA).toBe(true);
    expect(outsideA).toBe(false);

    // Verify Site B plant detection
    const insideB = isPointInsideZone([-35, 1, -20], siteB!);
    const outsideB = isPointInsideZone([35, 1, -20], siteB!);
    expect(insideB).toBe(true);
    expect(outsideB).toBe(false);
  });
});
