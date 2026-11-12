import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA_ZOOM,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  clampCameraZoom,
  computeAutoCameraZoom,
  createCamera,
  getWorldViewportSize,
  screenToWorld,
  updateCamera,
  worldToScreen,
} from './cameraMath';

describe('cameraMath zoom and transforms', () => {
  it('clamps zoom to tactical bounds', () => {
    expect(clampCameraZoom(0.1)).toBe(MIN_CAMERA_ZOOM);
    expect(clampCameraZoom(2.5)).toBe(MAX_CAMERA_ZOOM);
    expect(clampCameraZoom(NaN)).toBe(DEFAULT_CAMERA_ZOOM);
    expect(clampCameraZoom(0.754)).toBe(0.75);
  });

  it('computes auto zoom scaled down for phone viewports and 1.0 on desktop', () => {
    expect(computeAutoCameraZoom(1440, 900)).toBe(1.0);
    expect(computeAutoCameraZoom(1280, 720)).toBe(1.0);

    const landscapePhone = computeAutoCameraZoom(844, 390);
    expect(landscapePhone).toBeLessThan(0.8);
    expect(landscapePhone).toBeGreaterThanOrEqual(MIN_CAMERA_ZOOM);

    const portraitPhone = computeAutoCameraZoom(390, 844);
    expect(portraitPhone).toBe(MIN_CAMERA_ZOOM);
  });

  it('round-trips screenToWorld and worldToScreen under arbitrary zoom', () => {
    const cam = {
      ...createCamera(800, 400, 0.7),
      x: 240,
      y: 120,
    };

    const { worldX, worldY } = screenToWorld(350, 210, cam);
    expect(worldX).toBeCloseTo(240 + 350 / 0.7, 5);
    expect(worldY).toBeCloseTo(120 + 210 / 0.7, 5);

    const roundTrip = worldToScreen(worldX, worldY, cam);
    expect(roundTrip.screenX).toBeCloseTo(350, 5);
    expect(roundTrip.screenY).toBeCloseTo(210, 5);
  });

  it('computes zoomed world viewport dimensions and centers smaller arenas', () => {
    const cam = createCamera(1200, 800, 0.6);
    const view = getWorldViewportSize(cam);
    expect(view.worldViewWidth).toBeCloseTo(2000, 5);
    expect(view.worldViewHeight).toBeCloseTo(800 / 0.6, 5);

    // Arena smaller than zoomed-out viewport should center cleanly
    const updated = updateCamera(cam, 900, 500, 1800, 1000, 1);
    expect(updated.x).toBeCloseTo((1800 - 2000) / 2, 5);
    expect(updated.y).toBeCloseTo((1000 - 800 / 0.6) / 2, 5);
  });

  it('overscans past arena edges so players near red/blue flags stay centered away from mobile HUD/controls', () => {
    // iPhone SE landscape (667x375) at 0.55x zoom on Canyon Outpost (3200x1800)
    const cam = createCamera(667, 375, 0.55);
    const { worldViewWidth } = getWorldViewportSize(cam);

    // Player at Red Flag (x=2920, y=1320) should be centered in viewport
    const atRedFlag = updateCamera(cam, 2920, 1320, 3200, 1800, 1);
    const redScreen = worldToScreen(2920, 1320, atRedFlag);
    expect(redScreen.screenX).toBeCloseTo(667 / 2, 1);
    expect(atRedFlag.x + worldViewWidth).toBeGreaterThan(3200);

    // Player at Blue Flag (x=280, y=1320) should also be centered in viewport
    const atBlueFlag = updateCamera(cam, 280, 1320, 3200, 1800, 1);
    const blueScreen = worldToScreen(280, 1320, atBlueFlag);
    expect(blueScreen.screenX).toBeCloseTo(667 / 2, 1);
    expect(atBlueFlag.x).toBeLessThan(0);

    // Even right against the far right wall (x=3160), overscan is bounded
    const atRightWall = updateCamera(cam, 3160, 1320, 3200, 1800, 1);
    const wallScreen = worldToScreen(3160, 1320, atRightWall);
    expect(wallScreen.screenX).toBeLessThan(480);
  });
});
