export const MOVE_PAD_SIZE = 120;
export const MOVE_KNOB_SIZE = 40;
export const MOVE_MAX_DIST = (MOVE_PAD_SIZE - MOVE_KNOB_SIZE) / 2; // 40px

export const AIM_PAD_SIZE = 124;
export const AIM_KNOB_SIZE = 36;
export const AIM_MAX_DIST = (AIM_PAD_SIZE - AIM_KNOB_SIZE) / 2; // 44px
export const AIM_DEADZONE_DIST = 6;
export const AIM_FIRE_PERIMETER_DIST = AIM_MAX_DIST - 4; // 40px: knob edge touches perimeter ring

export const STICK_HIT_RADIUS = 104;

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

export function evaluateMoveStick(dx: number, dy: number): MoveStickEvaluation {
  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(MOVE_MAX_DIST, dist);
  const angle = Math.atan2(dy, dx);

  const offsetX = dist > 0 ? Math.cos(angle) * clampedDist : 0;
  const offsetY = dist > 0 ? Math.sin(angle) * clampedDist : 0;

  const rawNormX = Math.max(-1, Math.min(1, offsetX / 36));
  const moveX =
    Math.abs(rawNormX) > 0.14
      ? Math.sign(rawNormX) * Math.pow((Math.abs(rawNormX) - 0.14) / 0.86, 1.25)
      : 0;
  const boosting = offsetY < -18;
  const moveY = !boosting && offsetY > 20 ? 1 : 0;

  return {
    offsetX,
    offsetY,
    dist,
    moveX,
    moveY,
    boosting,
  };
}

export function evaluateAimStick(dx: number, dy: number): AimStickEvaluation {
  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(AIM_MAX_DIST, dist);
  const angle = Math.atan2(dy, dx);

  const offsetX = dist > 0 ? Math.cos(angle) * clampedDist : 0;
  const offsetY = dist > 0 ? Math.sin(angle) * clampedDist : 0;

  return {
    offsetX,
    offsetY,
    dist,
    angle,
    hasAim: dist >= AIM_DEADZONE_DIST,
    isFiring: dist >= AIM_FIRE_PERIMETER_DIST,
  };
}

export function pickFixedStickTarget(
  clientX: number,
  clientY: number,
  moveCenter: StickCenter | null,
  aimCenter: StickCenter | null,
  moveBusy: boolean,
  aimBusy: boolean,
): 'move' | 'aim' | null {
  const moveDist =
    !moveBusy && moveCenter
      ? Math.hypot(clientX - moveCenter.x, clientY - moveCenter.y)
      : Infinity;
  const aimDist =
    !aimBusy && aimCenter
      ? Math.hypot(clientX - aimCenter.x, clientY - aimCenter.y)
      : Infinity;

  const canMove = moveDist <= STICK_HIT_RADIUS;
  const canAim = aimDist <= STICK_HIT_RADIUS;

  if (!canMove && !canAim) return null;
  if (canMove && !canAim) return 'move';
  if (canAim && !canMove) return 'aim';
  return moveDist <= aimDist ? 'move' : 'aim';
}
