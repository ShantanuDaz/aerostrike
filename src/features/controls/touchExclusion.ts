import type { MinimapTargetState } from '../game/engineWorld';

export interface SimpleDOMRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const TOUCH_MOUSE_SUPPRESSION_MS = 600;

export function isPointInRadarExclusion(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  minimapTarget: MinimapTargetState,
  canvasRect?: SimpleDOMRect | null,
): boolean {
  if (minimapTarget.hidden) {
    return false;
  }

  if (canvasRect && canvasRect.width > 0 && canvasRect.height > 0) {
    return (
      clientX >= canvasRect.left - 8 &&
      clientX <= canvasRect.right + 8 &&
      clientY >= canvasRect.top - 26 &&
      clientY <= canvasRect.bottom + 8
    );
  }

  // Fallback top-right bounds anchored to MinimapView layout (`top-10/12 right-2/3` + 22px header)
  const minX = viewportWidth - minimapTarget.width - 20;
  const maxY = minimapTarget.height + 76;
  return clientX >= minX && clientY <= maxY;
}

export function shouldIgnoreSyntheticMouse(
  lastTouchTimeMs: number | undefined,
  nowMs: number = performance.now(),
): boolean {
  if (!lastTouchTimeMs) return false;
  return nowMs - lastTouchTimeMs < TOUCH_MOUSE_SUPPRESSION_MS;
}
