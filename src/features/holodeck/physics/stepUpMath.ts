import { sweptAABB, type AABB } from './sweptAABB';

export const MAX_STEP_HEIGHT = 0.45; // meters (stair step height)

/**
 * Attempts to step up an obstacle if forward horizontal motion was blocked by a low step/stair.
 */
export function tryStepUp(
  playerBox: AABB,
  deltaH: [number, number, number], // horizontal movement only (y = 0)
  obstacles: readonly AABB[],
  maxStep = MAX_STEP_HEIGHT,
): [number, number, number] | null {
  // 1. Elevate the test box by maxStep
  const elevatedBox: AABB = {
    min: [playerBox.min[0], playerBox.min[1] + maxStep, playerBox.min[2]],
    max: [playerBox.max[0], playerBox.max[1] + maxStep, playerBox.max[2]],
  };

  // 2. Test horizontal movement from the elevated position
  let allowedFraction = 1.0;
  for (const obs of obstacles) {
    const sweep = sweptAABB(elevatedBox, deltaH, obs);
    if (sweep.hit && sweep.time < allowedFraction) {
      allowedFraction = sweep.time;
    }
  }

  // If even elevated movement is immediately blocked, we cannot step up
  if (allowedFraction < 0.05) {
    return null;
  }

  const forwardStep: [number, number, number] = [
    deltaH[0] * allowedFraction,
    0,
    deltaH[2] * allowedFraction,
  ];

  // 3. Move elevated box forward
  const movedElevatedBox: AABB = {
    min: [
      elevatedBox.min[0] + forwardStep[0],
      elevatedBox.min[1],
      elevatedBox.min[2] + forwardStep[2],
    ],
    max: [
      elevatedBox.max[0] + forwardStep[0],
      elevatedBox.max[1],
      elevatedBox.max[2] + forwardStep[2],
    ],
  };

  // 4. Sweep downward to find the new floor
  const downDelta: [number, number, number] = [0, -maxStep, 0];
  let downFraction = 1.0;
  let hitGround = false;

  for (const obs of obstacles) {
    const sweep = sweptAABB(movedElevatedBox, downDelta, obs);
    if (sweep.hit && sweep.normal[1] > 0.7 && sweep.time < downFraction) {
      downFraction = sweep.time;
      hitGround = true;
    }
  }

  if (!hitGround) {
    return null;
  }

  // Final stepped delta
  const finalY = maxStep - downFraction * maxStep;
  return [forwardStep[0], finalY, forwardStep[2]];
}
