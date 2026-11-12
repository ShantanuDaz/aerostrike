import type { Camera } from './types';

export const MIN_CAMERA_ZOOM = 0.55;
export const MAX_CAMERA_ZOOM = 1.35;
export const DEFAULT_CAMERA_ZOOM = 1.0;
export const CAMERA_ZOOM_STEP = 0.1;
export const CAMERA_EDGE_OVERSCAN_X_RATIO = 0.28;
export const CAMERA_EDGE_OVERSCAN_Y_RATIO = 0.16;

export interface CameraOverscanOptions {
  overscanX?: number;
  overscanY?: number;
}

export function clampCameraZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return DEFAULT_CAMERA_ZOOM;
  }
  const clamped = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, zoom));
  return Math.round(clamped * 100) / 100;
}

/**
 * Computes a responsive tactical zoom level so smaller/mobile viewports
 * keep generous arena visibility comparable to desktop displays.
 */
export function computeAutoCameraZoom(
  viewportWidth: number,
  viewportHeight: number,
): number {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return DEFAULT_CAMERA_ZOOM;
  }

  const ratio = Math.min(viewportWidth / 1080, viewportHeight / 580);
  if (ratio >= 1) {
    return DEFAULT_CAMERA_ZOOM;
  }
  return clampCameraZoom(ratio);
}

export function getWorldViewportSize(camera: Camera): {
  worldViewWidth: number;
  worldViewHeight: number;
  zoom: number;
} {
  const zoom = camera.zoom > 0 ? camera.zoom : DEFAULT_CAMERA_ZOOM;
  return {
    worldViewWidth: camera.viewportWidth / zoom,
    worldViewHeight: camera.viewportHeight / zoom,
    zoom,
  };
}

export function createCamera(
  viewportWidth: number,
  viewportHeight: number,
  zoom: number = DEFAULT_CAMERA_ZOOM,
): Camera {
  return {
    x: 0,
    y: 0,
    viewportWidth,
    viewportHeight,
    zoom: clampCameraZoom(zoom),
  };
}

function clampAxisOffset(
  value: number,
  mapSize: number,
  worldViewSize: number,
  overscan: number = 0,
): number {
  const maxOffset = mapSize - worldViewSize;
  if (maxOffset <= 0) {
    // When zoomed out wider than the arena, center the arena cleanly in the viewport
    return maxOffset / 2;
  }
  const safeOverscan = Math.max(0, overscan);
  return Math.max(-safeOverscan, Math.min(value, maxOffset + safeOverscan));
}

/**
 * Smoothly interpolates the camera to center on the target point (player),
 * allowing generous edge overscan beyond the map walls so players near flags
 * and arena corners stay clearly visible away from side HUD/touch controls.
 */
export function updateCamera(
  camera: Camera,
  targetX: number,
  targetY: number,
  mapWidth: number,
  mapHeight: number,
  lerpFactor: number = 0.12,
  options?: CameraOverscanOptions,
): Camera {
  const { worldViewWidth, worldViewHeight } = getWorldViewportSize(camera);
  const overscanX =
    options?.overscanX !== undefined
      ? options.overscanX
      : worldViewWidth * CAMERA_EDGE_OVERSCAN_X_RATIO;
  const overscanY =
    options?.overscanY !== undefined
      ? options.overscanY
      : worldViewHeight * CAMERA_EDGE_OVERSCAN_Y_RATIO;

  // Desired top-left world position to center target in viewport
  const idealX = targetX - worldViewWidth / 2;
  const idealY = targetY - worldViewHeight / 2;

  // Lerp towards ideal position
  const lerpedX = camera.x + (idealX - camera.x) * lerpFactor;
  const lerpedY = camera.y + (idealY - camera.y) * lerpFactor;

  return {
    ...camera,
    x: clampAxisOffset(lerpedX, mapWidth, worldViewWidth, overscanX),
    y: clampAxisOffset(lerpedY, mapHeight, worldViewHeight, overscanY),
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
  const zoom = camera.zoom > 0 ? camera.zoom : DEFAULT_CAMERA_ZOOM;
  return {
    worldX: screenX / zoom + camera.x,
    worldY: screenY / zoom + camera.y,
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
  const zoom = camera.zoom > 0 ? camera.zoom : DEFAULT_CAMERA_ZOOM;
  return {
    screenX: (worldX - camera.x) * zoom,
    screenY: (worldY - camera.y) * zoom,
  };
}
