import type { Camera } from './types';

export function createCamera(viewportWidth: number, viewportHeight: number): Camera {
  return {
    x: 0,
    y: 0,
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Smoothly interpolates the camera to center on the target point (player),
 * clamped to the map boundaries.
 */
export function updateCamera(
  camera: Camera,
  targetX: number,
  targetY: number,
  mapWidth: number,
  mapHeight: number,
  lerpFactor: number = 0.12,
): Camera {
  // Desired top-left position to center target in viewport
  const idealX = targetX - camera.viewportWidth / 2;
  const idealY = targetY - camera.viewportHeight / 2;

  // Maximum scroll offsets
  const maxX = Math.max(0, mapWidth - camera.viewportWidth);
  const maxY = Math.max(0, mapHeight - camera.viewportHeight);

  // Lerp towards ideal position
  let nextX = camera.x + (idealX - camera.x) * lerpFactor;
  let nextY = camera.y + (idealY - camera.y) * lerpFactor;

  // Clamp within map bounds
  nextX = Math.max(0, Math.min(nextX, maxX));
  nextY = Math.max(0, Math.min(nextY, maxY));

  return {
    ...camera,
    x: nextX,
    y: nextY,
  };
}

/**
 * Converts screen/canvas coordinate to world coordinate.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
): { worldX: number; worldY: number } {
  return {
    worldX: screenX + camera.x,
    worldY: screenY + camera.y,
  };
}

/**
 * Converts world coordinate to screen/canvas coordinate.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
): { screenX: number; screenY: number } {
  return {
    screenX: worldX - camera.x,
    screenY: worldY - camera.y,
  };
}
