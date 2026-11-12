import type { TouchAimMode } from '../settings/settingsStore';

export const MOVE_PAD_SIZE = 120;
export const MOVE_KNOB_SIZE = 40;
export const MOVE_MAX_DIST = (MOVE_PAD_SIZE - MOVE_KNOB_SIZE) / 2; // 40px

export const AIM_PAD_SIZE = 124;
export const AIM_KNOB_SIZE = 36;
export const AIM_MAX_DIST = (AIM_PAD_SIZE - AIM_KNOB_SIZE) / 2; // 44px
export const AIM_DEADZONE_DIST = 6;
export const AIM_FIRE_PERIMETER_DIST = AIM_MAX_DIST - 2; // 42px: knob edge reaches outer perimeter ring

export const STICK_HIT_RADIUS = 104;

export interface ScaledStickMetrics {
  scale: number;
  movePadSize: number;
  moveKnobSize: number;
  moveMaxDist: number;
  aimPadSize: number;
  aimKnobSize: number;
  aimMaxDist: number;
  aimDeadzoneDist: number;
  aimFirePerimeterDist: number;
  aimPerimeterRingSize: number;
  stickHitRadius: number;
}

export function getScaledStickMetrics(
  rawScale: number = 1,
  rawDeadzone: number = AIM_DEADZONE_DIST,
): ScaledStickMetrics {
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.max(0.5, Math.min(1.5, rawScale)) : 1;
  const movePadSize = Math.round(MOVE_PAD_SIZE * scale);
  const moveKnobSize = Math.round(MOVE_KNOB_SIZE * scale);
  const moveMaxDist = Math.max(16, (movePadSize - moveKnobSize) / 2);

  const aimPadSize = Math.round(AIM_PAD_SIZE * scale);
  const aimKnobSize = Math.round(AIM_KNOB_SIZE * scale);
  const aimMaxDist = Math.max(18, (aimPadSize - aimKnobSize) / 2);
  const aimDeadzoneDist = Math.max(
    2,
    Math.min(aimMaxDist - 6, Number.isFinite(rawDeadzone) ? rawDeadzone : AIM_DEADZONE_DIST),
  );
  const perimeterInset = Math.max(1.5, Math.round(2 * scale * 2) / 2);
  const aimFirePerimeterDist = Math.max(aimDeadzoneDist + 4, aimMaxDist - perimeterInset);
  const aimPerimeterRingSize = Math.round(aimFirePerimeterDist * 2 + aimKnobSize);
  const stickHitRadius = Math.round(STICK_HIT_RADIUS * scale);

  return {
    scale,
    movePadSize,
    moveKnobSize,
    moveMaxDist,
    aimPadSize,
    aimKnobSize,
    aimMaxDist,
    aimDeadzoneDist,
    aimFirePerimeterDist,
    aimPerimeterRingSize,
    stickHitRadius,
  };
}

export interface StickCenter {
  x: number;
  y: number;
}

export interface MoveStickEvaluation {
  offsetX: number;
  offsetY: number;
  dist: number;
  moveX: number;
  moveY: number;
  boosting: boolean;
}

export interface AimStickEvaluation {
  offsetX: number;
  offsetY: number;
  dist: number;
  angle: number;
  hasAim: boolean;
  isFiring: boolean;
}

export interface AimStickOptions {
  maxDist?: number;
  deadzoneDist?: number;
  firePerimeterDist?: number;
  aimMode?: TouchAimMode;
}

export function evaluateMoveStick(
  dx: number,
  dy: number,
  maxDist: number = MOVE_MAX_DIST,
): MoveStickEvaluation {
  const safeMaxDist = maxDist > 0 ? maxDist : MOVE_MAX_DIST;
  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(safeMaxDist, dist);
  const angle = Math.atan2(dy, dx);

  const offsetX = dist > 0 ? Math.cos(angle) * clampedDist : 0;
  const offsetY = dist > 0 ? Math.sin(angle) * clampedDist : 0;

  const rawNormX = Math.max(-1, Math.min(1, offsetX / (safeMaxDist * 0.9)));
  const moveX =
    Math.abs(rawNormX) > 0.14
      ? Math.sign(rawNormX) * Math.pow((Math.abs(rawNormX) - 0.14) / 0.86, 1.25)
      : 0;
  const boosting = offsetY < -(safeMaxDist * 0.45);
  const moveY = !boosting && offsetY > safeMaxDist * 0.5 ? 1 : 0;

  return {
    offsetX,
    offsetY,
    dist,
    moveX,
    moveY,
    boosting,
  };
}

export function evaluateAimStick(
  dx: number,
  dy: number,
  options?: AimStickOptions,
): AimStickEvaluation {
  const maxDist = options?.maxDist && options.maxDist > 0 ? options.maxDist : AIM_MAX_DIST;
  const deadzoneDist =
    options?.deadzoneDist && options.deadzoneDist > 0 ? options.deadzoneDist : AIM_DEADZONE_DIST;
  const firePerimeterDist =
    options?.firePerimeterDist && options.firePerimeterDist > 0
      ? options.firePerimeterDist
      : AIM_FIRE_PERIMETER_DIST;
  const aimMode = options?.aimMode ?? 'precision';

  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(maxDist, dist);
  const angle = Math.atan2(dy, dx);

  const offsetX = dist > 0 ? Math.cos(angle) * clampedDist : 0;
  const offsetY = dist > 0 ? Math.sin(angle) * clampedDist : 0;
  const hasAim = dist >= deadzoneDist;
  const isFiring = aimMode === 'instant' ? hasAim : dist >= firePerimeterDist;

  return {
    offsetX,
    offsetY,
    dist,
    angle,
    hasAim,
    isFiring,
  };
}

export function pickFixedStickTarget(
  clientX: number,
  clientY: number,
  moveCenter: StickCenter | null,
  aimCenter: StickCenter | null,
  moveBusy: boolean,
  aimBusy: boolean,
  hitRadius: number = STICK_HIT_RADIUS,
): 'move' | 'aim' | null {
  const safeHitRadius = hitRadius > 0 ? hitRadius : STICK_HIT_RADIUS;
  const moveDist =
    !moveBusy && moveCenter
      ? Math.hypot(clientX - moveCenter.x, clientY - moveCenter.y)
      : Infinity;
  const aimDist =
    !aimBusy && aimCenter
      ? Math.hypot(clientX - aimCenter.x, clientY - aimCenter.y)
      : Infinity;

  const canMove = moveDist <= safeHitRadius;
  const canAim = aimDist <= safeHitRadius;

  if (!canMove && !canAim) return null;
  if (canMove && !canAim) return 'move';
  if (canAim && !canMove) return 'aim';
  return moveDist <= aimDist ? 'move' : 'aim';
}
