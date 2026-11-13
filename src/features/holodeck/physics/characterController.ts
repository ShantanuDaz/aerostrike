import { sweptAABB, type AABB } from './sweptAABB';
import { tryStepUp } from './stepUpMath';

export interface KCCInput {
  moveForward: number; // -1 (back) to +1 (forward)
  moveRight: number; // -1 (left) to +1 (right)
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  yaw: number; // radians
}

export interface KCCState {
  position: [number, number, number];
  velocity: [number, number, number];
  isGrounded: boolean;
  isCrouching: boolean;
  cameraHeight: number;
  coyoteTimerSec?: number;
}

export interface KCCConfig {
  walkSpeed: number; // m/s
  sprintSpeed: number; // m/s
  crouchSpeed: number; // m/s
  jumpVelocity: number; // m/s
  gravity: number; // m/s^2
  standHeight: number; // m
  crouchHeight: number; // m
  radius: number; // m
  counterStrafeDecelTime: number; // seconds to stop
  crouchTransitionSpeed: number; // m/s
}

export const DEFAULT_KCC_CONFIG: KCCConfig = {
  walkSpeed: 5.4,
  sprintSpeed: 6.8,
  crouchSpeed: 2.8,
  jumpVelocity: 6.5, // 6.5 m/s jump velocity reaches peak height ~1.41m (clears 0.8m & 1.0m platforms easily)
  gravity: 15.0,
  standHeight: 1.8,
  crouchHeight: 1.1,
  radius: 0.35,
  counterStrafeDecelTime: 0.08, // snappy 0.08s tactical counter-strafing
  crouchTransitionSpeed: 8.0,
};

export function createInitialKCCState(spawnPos: [number, number, number] = [0, 0, 0]): KCCState {
  return {
    position: [...spawnPos],
    velocity: [0, 0, 0],
    isGrounded: true,
    isCrouching: false,
    cameraHeight: DEFAULT_KCC_CONFIG.standHeight,
    coyoteTimerSec: 0.12,
  };
}

export function getPlayerAABB(
  pos: [number, number, number],
  height: number,
  radius: number,
  isGrounded = true,
): AABB {
  // When in air and crouching, the player tucks their legs up (tuckAmount up to 0.7m)
  const legTuck = !isGrounded ? Math.max(0, DEFAULT_KCC_CONFIG.standHeight - height) : 0;
  return {
    min: [pos[0] - radius, pos[1] + legTuck, pos[2] - radius],
    max: [pos[0] + radius, pos[1] + height + legTuck, pos[2] + radius],
  };
}

/**
 * Steps the Kinematic Character Controller by dt seconds against a static environment.
 */
export function stepCharacterController(
  state: KCCState,
  input: KCCInput,
  colliders: readonly AABB[],
  dt: number,
  config: KCCConfig = DEFAULT_KCC_CONFIG,
): KCCState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.1);

  // 1. Crouch interpolation
  const targetHeight = input.crouch ? config.crouchHeight : config.standHeight;
  const heightDelta = targetHeight - state.cameraHeight;
  const stepHeight = Math.sign(heightDelta) * Math.min(Math.abs(heightDelta), config.crouchTransitionSpeed * clampedDt);
  const nextCameraHeight = state.cameraHeight + stepHeight;
  const isCrouching = nextCameraHeight < (config.standHeight + config.crouchHeight) / 2;

  // 2. Desired horizontal movement direction in world space
  const cosYaw = Math.cos(input.yaw);
  const sinYaw = Math.sin(input.yaw);

  // In Three.js: -Z is forward, +X is right
  const forwardX = -sinYaw;
  const forwardZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let wishX = forwardX * input.moveForward + rightX * input.moveRight;
  let wishZ = forwardZ * input.moveForward + rightZ * input.moveRight;
  const wishLen = Math.hypot(wishX, wishZ);

  const targetSpeed = isCrouching && state.isGrounded
    ? config.crouchSpeed
    : input.sprint
      ? config.sprintSpeed
      : config.walkSpeed;

  let vx = state.velocity[0];
  let vy = state.velocity[1];
  let vz = state.velocity[2];

  if (wishLen > 0.001) {
    wishX = (wishX / wishLen) * targetSpeed;
    wishZ = (wishZ / wishLen) * targetSpeed;

    // Fast snappy acceleration (instantly matches or reaches target within 0.05s)
    const accelRate = targetSpeed / 0.05;
    const dvx = wishX - vx;
    const dvz = wishZ - vz;
    const maxStep = accelRate * clampedDt;
    const deltaMag = Math.hypot(dvx, dvz);
    if (deltaMag <= maxStep) {
      vx = wishX;
      vz = wishZ;
    } else {
      vx += (dvx / deltaMag) * maxStep;
      vz += (dvz / deltaMag) * maxStep;
    }
  } else {
    // Only apply aggressive counter-strafing ground brake when grounded
    if (state.isGrounded) {
      const decelRate = config.walkSpeed / config.counterStrafeDecelTime;
      const curSpeed = Math.hypot(vx, vz);
      if (curSpeed > 0) {
        const drop = decelRate * clampedDt;
        const newSpeed = Math.max(0, curSpeed - drop);
        vx = (vx / curSpeed) * newSpeed;
        vz = (vz / curSpeed) * newSpeed;
        if (newSpeed < 0.02) {
          vx = 0;
          vz = 0;
        }
      }
    }
  }

  // 3. Jump and Gravity with Coyote Time
  let coyoteTimerSec = state.isGrounded
    ? 0.12
    : Math.max(0, (state.coyoteTimerSec ?? 0) - clampedDt);

  if (input.jump && (state.isGrounded || coyoteTimerSec > 0)) {
    vy = config.jumpVelocity;
    state.isGrounded = false;
    coyoteTimerSec = 0;
  } else if (state.isGrounded) {
    vy = -1.0; // slight stick-to-ground velocity
  } else {
    vy -= config.gravity * clampedDt;
    // Low air friction preserves horizontal jump momentum
    vx *= Math.pow(0.995, clampedDt * 60);
    vz *= Math.pow(0.995, clampedDt * 60);
  }

  // 4. Collision resolution: Sweep horizontal and vertical with stair step-up & platform clearance
  let posX = state.position[0];
  let posY = state.position[1];
  let posZ = state.position[2];

  let currentBox = getPlayerAABB([posX, posY, posZ], nextCameraHeight, config.radius, state.isGrounded);

  if (vy > 0) {
    // === UPWARD ASCENT PHASE (vy > 0) ===
    // 1. Resolve upward vertical step FIRST so feet clear obstacles as you rise
    const deltaV: [number, number, number] = [0, vy * clampedDt, 0];
    let vFraction = 1.0;
    for (const col of colliders) {
      const sweep = sweptAABB(currentBox, deltaV, col);
      if (sweep.hit && sweep.time < vFraction) {
        vFraction = sweep.time;
        if (sweep.normal[1] < -0.7) {
          vy = 0; // Bonked head on ceiling
        }
      }
    }
    posY += deltaV[1] * vFraction;

    // 2. Resolve horizontal movement at the newly elevated height
    currentBox = getPlayerAABB([posX, posY, posZ], nextCameraHeight, config.radius, false);
    const deltaH: [number, number, number] = [vx * clampedDt, 0, vz * clampedDt];
    let hitObstacle = false;
    let minFraction = 1.0;
    let slideNormal: [number, number, number] = [0, 0, 0];

    for (const col of colliders) {
      const sweep = sweptAABB(currentBox, deltaH, col);
      if (sweep.hit && sweep.time < minFraction) {
        minFraction = sweep.time;
        hitObstacle = true;
        slideNormal = sweep.normal;
      }
    }

    if (!hitObstacle) {
      posX += deltaH[0];
      posZ += deltaH[2];
    } else {
      // Try step-up / ledge mantling
      const stepped = tryStepUp(currentBox, deltaH, colliders, 0.55);
      if (stepped) {
        posX += stepped[0];
        posY += stepped[1];
        posZ += stepped[2];
      } else {
        posX += deltaH[0] * Math.max(0, minFraction - 0.001);
        posZ += deltaH[2] * Math.max(0, minFraction - 0.001);
        const dot = vx * slideNormal[0] + vz * slideNormal[2];
        vx -= dot * slideNormal[0];
        vz -= dot * slideNormal[2];
      }
    }

    return {
      position: [posX, posY, posZ],
      velocity: [vx, vy, vz],
      isGrounded: false,
      isCrouching,
      cameraHeight: nextCameraHeight,
      coyoteTimerSec,
    };
  } else {
    // === DOWNWARD / FALLING / GROUNDED PHASE (vy <= 0) ===
    // 1. Resolve horizontal movement first (with stair step-up)
    const deltaH: [number, number, number] = [vx * clampedDt, 0, vz * clampedDt];
    let hitObstacle = false;
    let minFraction = 1.0;
    let slideNormal: [number, number, number] = [0, 0, 0];

    for (const col of colliders) {
      const sweep = sweptAABB(currentBox, deltaH, col);
      if (sweep.hit && sweep.time < minFraction) {
        minFraction = sweep.time;
        hitObstacle = true;
        slideNormal = sweep.normal;
      }
    }

    if (!hitObstacle) {
      posX += deltaH[0];
      posZ += deltaH[2];
    } else {
      const stepped = tryStepUp(currentBox, deltaH, colliders, 0.45);
      if (stepped) {
        posX += stepped[0];
        posY += stepped[1];
        posZ += stepped[2];
      } else {
        posX += deltaH[0] * Math.max(0, minFraction - 0.001);
        posZ += deltaH[2] * Math.max(0, minFraction - 0.001);
        const dot = vx * slideNormal[0] + vz * slideNormal[2];
        vx -= dot * slideNormal[0];
        vz -= dot * slideNormal[2];
      }
    }

    // 2. Resolve vertical downward sweep (landing on floor / platform)
    currentBox = getPlayerAABB([posX, posY, posZ], nextCameraHeight, config.radius, state.isGrounded);
    const deltaV: [number, number, number] = [0, vy * clampedDt, 0];
    let groundHit = false;
    let vFraction = 1.0;

    for (const col of colliders) {
      const sweep = sweptAABB(currentBox, deltaV, col);
      if (sweep.hit && sweep.time < vFraction) {
        vFraction = sweep.time;
        if (sweep.normal[1] > 0.7) {
          groundHit = true;
        }
      }
    }

    posY += deltaV[1] * vFraction;
    if (groundHit) {
      vy = 0;
    }

    return {
      position: [posX, posY, posZ],
      velocity: [vx, vy, vz],
      isGrounded: groundHit,
      isCrouching,
      cameraHeight: nextCameraHeight,
      coyoteTimerSec,
    };
  }
}
