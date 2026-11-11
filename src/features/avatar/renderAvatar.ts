import type { AvatarConfig } from './types';
import type { WeaponType } from '../combat/types';
import {
  drawCombatBoot,
  drawEquippedWeapon,
  drawHeadAndGear,
  drawJetpackModule,
  drawLimbSegment,
  getSoldierPalette,
  solveTwoBoneIK,
} from './renderAvatarParts';

export interface RenderAvatarOptions {
  aimAngle: number;
  radius: number;
  isBoosting?: boolean;
  team?: 'blue' | 'red';
  healthPercent?: number; // 0 to 1
  fuelPercent?: number;   // 0 to 1
  showHUD?: boolean;
  vx?: number;
  vy?: number;
  isGrounded?: boolean;
  timeSec?: number;
  weaponType?: WeaponType;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Procedurally draws a fully articulated multi-limb humanoid exo-soldier
 * (no longer a spherical ball) on a 2D canvas context.
 * Assumes context is already translated to (player.x, player.y).
 */
export function renderAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarConfig,
  options: RenderAvatarOptions,
): void {
  const {
    aimAngle,
    radius,
    isBoosting = false,
    team,
    healthPercent = 1,
    showHUD = true,
    vx = 0,
    vy = 0,
    isGrounded = false,
    timeSec = 0,
    weaponType = 'rifle',
  } = options;

  const scale = radius / 16;
  const facing = Math.cos(aimAngle) >= 0 ? 1 : -1;
  const palette = getSoldierPalette(avatar, team);

  // Subtle torso lean driven by horizontal speed
  const bodyTilt = clamp(vx * 0.055, -0.28, 0.28);

  ctx.save();
  ctx.scale(scale, scale);

  // Subtle vertical hover bob if jetpacking stationary or idling
  const hoverBob = isGrounded && Math.abs(vx) > 0.3
    ? Math.abs(Math.sin(timeSec * 11)) * -1.8
    : !isGrounded
    ? Math.sin(timeSec * 5) * 1.2
    : Math.sin(timeSec * 3) * 0.6;

  // --- COMPUTE KINEMATIC JOINTS IN CHARACTER SPACE ---
  const tiltCos = Math.cos(bodyTilt);
  const tiltSin = Math.sin(bodyTilt);
  const rotatePt = (lx: number, ly: number) => ({
    x: lx * tiltCos - ly * tiltSin,
    y: lx * tiltSin + ly * tiltCos + hoverBob,
  });

  const pelvis = rotatePt(0, 6);
  const shoulderCenter = rotatePt(facing * 1.2, -4.5);
  const headCenter = rotatePt(facing * 0.5, -16);
  const jetpackAnchor = rotatePt(-facing * 6.5, -2);

  // --- COMPUTE LEGS (GROUNDED RUN/STANCE VS AIRBORNE DANGLING PHYSICS) ---
  let backFootTarget: { x: number; y: number };
  let frontFootTarget: { x: number; y: number };

  if (isGrounded) {
    const speedMag = Math.abs(vx);
    if (speedMag > 0.25) {
      const strideSpeed = 11 * clamp(speedMag / 2.2, 0.65, 1.35);
      const phase = timeSec * strideSpeed * (vx >= 0 ? 1 : -1);
      frontFootTarget = {
        x: Math.sin(phase) * 9.5 + facing * 1.5,
        y: 24.5 - Math.max(0, Math.cos(phase)) * 5.2,
      };
      backFootTarget = {
        x: Math.sin(phase + Math.PI) * 9.5 + facing * 1.5,
        y: 24.5 - Math.max(0, Math.cos(phase + Math.PI)) * 5.2,
      };
    } else {
      // Planted combat stance
      frontFootTarget = { x: facing * 5.5, y: 24.5 };
      backFootTarget = { x: -facing * 4.5, y: 24.5 };
    }
  } else {
    // Airborne ragdoll-inspired dangling leg inertia
    const trailX = clamp(-vx * 2.6, -10.5, 10.5);
    const dropY = clamp(23.5 - Math.min(0, vy) * 0.85, 17, 25);
    const sway = Math.sin(timeSec * 7) * (isBoosting ? 2.2 : 1.1);
    frontFootTarget = {
      x: trailX + facing * 3.5 + sway,
      y: dropY,
    };
    backFootTarget = {
      x: trailX - facing * 4.2 - sway * 0.8,
      y: dropY - 1.5,
    };
  }

  const backHip = { x: pelvis.x - facing * 2.2, y: pelvis.y };
  const frontHip = { x: pelvis.x + facing * 2.2, y: pelvis.y };

  const backLegIK = solveTwoBoneIK(
    backHip.x,
    backHip.y,
    backFootTarget.x,
    backFootTarget.y,
    9.5,
    9.5,
    -facing,
  );
  const frontLegIK = solveTwoBoneIK(
    frontHip.x,
    frontHip.y,
    frontFootTarget.x,
    frontFootTarget.y,
    9.5,
    9.5,
    -facing,
  );

  // --- COMPUTE DUAL ARMS & WEAPON RIG ---
  const gunPivotDist = 8;
  const gunGripX = shoulderCenter.x + Math.cos(aimAngle) * gunPivotDist;
  const gunGripY = shoulderCenter.y + Math.sin(aimAngle) * gunPivotDist;

  const foregripOffset = weaponType === 'pistol' ? 3 : 9;
  const foregripX = gunGripX + Math.cos(aimAngle) * foregripOffset;
  const foregripY = gunGripY + Math.sin(aimAngle) * foregripOffset;

  const backArmIK = solveTwoBoneIK(
    shoulderCenter.x + facing * 2,
    shoulderCenter.y - 0.5,
    foregripX,
    foregripY,
    8.5,
    8,
    facing,
  );
  const frontArmIK = solveTwoBoneIK(
    shoulderCenter.x - facing * 1.5,
    shoulderCenter.y + 0.5,
    gunGripX,
    gunGripY,
    8.5,
    7.5,
    facing,
  );

  // Compute head look pitch clamped naturally
  let localAimPitch = Math.atan2(
    Math.sin(aimAngle),
    Math.abs(Math.cos(aimAngle)),
  );
  localAimPitch = clamp(localAimPitch, -0.45, 0.45) * facing;

  // --- PAINTER'S ORDER RENDERING (BACK TO FRONT) ---

  // 1. Jetpack behind torso
  ctx.save();
  ctx.translate(jetpackAnchor.x, jetpackAnchor.y);
  ctx.rotate(bodyTilt);
  ctx.scale(facing, 1);
  drawJetpackModule(ctx, avatar, isBoosting, timeSec);
  ctx.restore();

  // 2. Back Leg (darker shaded)
  drawLimbSegment(
    ctx,
    backHip.x,
    backHip.y,
    backLegIK.jointX,
    backLegIK.jointY,
    4.6,
    palette.secondary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    backLegIK.jointX,
    backLegIK.jointY,
    backLegIK.endX,
    backLegIK.endY,
    4.0,
    palette.joint,
    palette.outline,
    palette.secondary,
  );
  const backBootAngle = isGrounded
    ? 0
    : clamp((backLegIK.endX - backLegIK.jointX) * 0.04, -0.35, 0.35);
  drawCombatBoot(
    ctx,
    backLegIK.endX,
    backLegIK.endY,
    backBootAngle,
    facing,
    palette.secondary,
    palette.trim,
  );

  // 3. Back Support Arm (holding foregrip)
  drawLimbSegment(
    ctx,
    shoulderCenter.x + facing * 2,
    shoulderCenter.y - 0.5,
    backArmIK.jointX,
    backArmIK.jointY,
    3.6,
    palette.secondary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    backArmIK.jointX,
    backArmIK.jointY,
    backArmIK.endX,
    backArmIK.endY,
    3.2,
    palette.joint,
    palette.outline,
    palette.secondary,
  );

  // 4. Armored Torso Chassis
  ctx.save();
  ctx.translate(0, hoverBob);
  ctx.rotate(bodyTilt);

  // Core exo-chestplate
  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-6.5, -8.5, 13, 15.5, 4);
  ctx.fill();
  ctx.stroke();

  // Tactical Vest Harness / Center Core Plate
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-4.5, -5.5, 9, 9.5, 2);
  ctx.fill();

  // Tactical Utility Belt
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-6.5, 4.2, 13, 2.8);
  ctx.fillStyle = palette.trim;
  ctx.fillRect(facing * 2 - 1.5, 4.6, 3, 2);

  // Chest Telemetry LED
  ctx.fillStyle = palette.trim;
  ctx.fillRect(facing * 2.5 - 1.5, -3.5, 3, 2.2);

  ctx.restore();

  // 5. Front Leg
  drawLimbSegment(
    ctx,
    frontHip.x,
    frontHip.y,
    frontLegIK.jointX,
    frontLegIK.jointY,
    4.8,
    palette.primary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    frontLegIK.jointX,
    frontLegIK.jointY,
    frontLegIK.endX,
    frontLegIK.endY,
    4.2,
    palette.joint,
    palette.outline,
    palette.trim,
  );
  const frontBootAngle = isGrounded
    ? 0
    : clamp((frontLegIK.endX - frontLegIK.jointX) * 0.04, -0.35, 0.35);
  drawCombatBoot(
    ctx,
    frontLegIK.endX,
    frontLegIK.endY,
    frontBootAngle,
    facing,
    palette.primary,
    palette.trim,
  );

  // 6. Head + Helmet + Visor
  ctx.save();
  ctx.translate(headCenter.x, headCenter.y);
  ctx.rotate(bodyTilt * 0.5 + localAimPitch * 0.55);
  drawHeadAndGear(ctx, avatar, facing, palette, timeSec);
  ctx.restore();

  // 7. Equipped Weapon (aligned upright at aimAngle)
  ctx.save();
  ctx.translate(gunGripX, gunGripY);
  ctx.rotate(aimAngle);
  if (facing === -1) {
    ctx.scale(1, -1);
  }
  drawEquippedWeapon(ctx, weaponType);
  ctx.restore();

  // 8. Front Trigger Arm
  drawLimbSegment(
    ctx,
    shoulderCenter.x - facing * 1.5,
    shoulderCenter.y + 0.5,
    frontArmIK.jointX,
    frontArmIK.jointY,
    3.8,
    palette.primary,
    palette.outline,
  );
  drawLimbSegment(
    ctx,
    frontArmIK.jointX,
    frontArmIK.jointY,
    frontArmIK.endX,
    frontArmIK.endY,
    3.4,
    palette.joint,
    palette.outline,
    palette.trim,
  );
  // Tactile glove on grip
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(frontArmIK.endX, frontArmIK.endY, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Restore scale

  // 9. HEALTH BAR + CALLSIGN (Drawn cleanly above helmet for opponents/allies)
  if (showHUD) {
    const barWidth = 34;
    const barHeight = 3.5;
    const barX = -barWidth / 2;
    const barY = -32 * scale - 6;

    ctx.save();
    ctx.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = team === 'blue' ? '#bae6fd' : team === 'red' ? '#fecdd3' : '#f8fafc';
    ctx.fillText(avatar.callsign || 'Pilot', 0, barY - 4);

    // Sleek framed health bar
    ctx.fillStyle = 'rgba(6, 9, 19, 0.85)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = healthPercent > 0.35 ? (team === 'blue' ? '#38bdf8' : '#fb7185') : '#f43f5e';
    ctx.fillRect(barX, barY, Math.max(0, healthPercent) * barWidth, barHeight);

    ctx.restore();
  }
}
