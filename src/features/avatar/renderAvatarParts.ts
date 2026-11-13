import type { AvatarConfig } from './types';
import type { WeaponType } from '../combat/types';

export interface SoldierPalette {
  primary: string;
  secondary: string;
  trim: string;
  joint: string;
  outline: string;
}

export function getSoldierPalette(
  avatar: AvatarConfig,
  team?: 'blue' | 'red',
): SoldierPalette {
  if (team === 'blue') {
    return {
      primary: '#2563eb',
      secondary: '#1d4ed8',
      trim: '#38bdf8',
      joint: '#1e293b',
      outline: '#0f172a',
    };
  }
  if (team === 'red') {
    return {
      primary: '#dc2626',
      secondary: '#b91c1c',
      trim: '#fb7185',
      joint: '#1e293b',
      outline: '#0f172a',
    };
  }
  return {
    primary: avatar.bodyColor || '#00f0ff',
    secondary: '#1e293b',
    trim: avatar.bodyColor || '#38bdf8',
    joint: '#334155',
    outline: '#090d16',
  };
}

/**
 * Analytic 2-bone Inverse Kinematics solver for elbows and knees.
 * Keeps limbs naturally bent and eliminates NaN edge cases.
 */
export function solveTwoBoneIK(
  rootX: number,
  rootY: number,
  targetX: number,
  targetY: number,
  len1: number,
  len2: number,
  bendSign: number,
): { jointX: number; jointY: number; endX: number; endY: number } {
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(len1 - len2) + 0.5;
  const maxDist = (len1 + len2) * 0.97;
  const dist = Math.max(minDist, Math.min(maxDist, rawDist || 0.001));

  const baseAngle = Math.atan2(dy, dx);
  const cosAngle1 =
    (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle1));
  const localAngle1 = Math.acos(clampedCos);

  const jointAngle = baseAngle + bendSign * localAngle1;
  const jointX = rootX + Math.cos(jointAngle) * len1;
  const jointY = rootY + Math.sin(jointAngle) * len1;

  const endX = rootX + Math.cos(baseAngle) * dist;
  const endY = rootY + Math.sin(baseAngle) * dist;

  return { jointX, jointY, endX, endY };
}

/**
 * Draws an armored limb bone segment between two points with rounded joint caps.
 */
export function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  fillColor: string,
  outlineColor: string,
  accentColor?: string,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer silhouette outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = thickness + 2.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Inner armor plate
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Optional metallic armor highlight / knee/elbow pad dot
  if (accentColor) {
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(x1, y1, thickness * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCombatBoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  facing: number,
  fillColor: string,
  trimColor: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(facing, 1);

  // Boot chassis
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-3, -2.5, 9, 5.5, 2);
  ctx.fill();

  // Armored shin cuff
  ctx.fillStyle = fillColor;
  ctx.fillRect(-3, -2.5, 4.5, 3);

  // Neon thruster sole
  ctx.fillStyle = trimColor;
  ctx.fillRect(-2.5, 2, 8, 1.5);

  ctx.restore();
}

/**
 * Draws backpack jetpack unit centered on the back spine.
 * Assumes character faces +X in local context (caller mirrors if facing left).
 */
export function drawJetpackModule(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarConfig,
  isBoosting: boolean,
  timeSec: number,
): void {
  ctx.save();
  const flicker = 0.8 + Math.sin(timeSec * 38) * 0.2;

  if (avatar.jetpackStyle === 'dual_tank') {
    // Twin metallic canisters
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-4.5, -7, 8, 14, 2.5);
    ctx.fill();
    ctx.stroke();

    // Nozzle cap
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-3.5, 6, 6, 2.5);

    if (isBoosting) {
      const len = 12 * flicker;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-3.5, 8.5);
      ctx.lineTo(2.5, 8.5);
      ctx.lineTo(-0.5, 8.5 + len);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-2, 8.5);
      ctx.lineTo(1, 8.5);
      ctx.lineTo(-0.5, 8.5 + len * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  } else if (avatar.jetpackStyle === 'falcon_wings') {
    // Swept tactical thruster wing
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-7, 4);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isBoosting) {
      const flameR = (4.5 + Math.sin(timeSec * 42) * 1.5) * flicker;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(-1, 5);
      ctx.lineTo(-4.5, 6 + flameR * 2.2);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Single Heavy Reactor Cylinder
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-5.5, -7.5, 9, 15, 3);
    ctx.fill();
    ctx.stroke();

    // Glowing reactor core line
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(-3.5, -3, 3, 6);

    if (isBoosting) {
      const len = 14 * flicker;
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(-4, 7.5);
      ctx.lineTo(2, 7.5);
      ctx.lineTo(-1, 7.5 + len);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws the soldier head, visor/optics, and custom headgear.
 * Assumes local origin is head center, and up is -Y. Mirrors horizontally by facing.
 */
export function drawHeadAndGear(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarConfig,
  facing: number,
  palette: SoldierPalette,
  timeSec: number = 0,
): void {
  const headRadius = 8.5;

  ctx.save();
  ctx.scale(facing, 1);

  // 1. Cranium / Helmet Shell Base
  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lower face / chin plate subtly tinted with skinTone or dark tactical mask
  ctx.fillStyle = avatar.skinTone || '#e2e8f0';
  ctx.beginPath();
  ctx.arc(2.5, 1.5, headRadius * 0.62, -0.35, Math.PI * 0.6);
  ctx.fill();

  // 2. Optics / Visor (Facing +X)
  if (avatar.visorStyle === 'classic') {
    ctx.fillStyle = avatar.visorColor || '#0f172a';
    ctx.beginPath();
    ctx.roundRect(1, -3.5, 7.5, 5.2, 2);
    ctx.fill();
    // Glint highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(3, -2.5, 3.5, 1.2);
  } else if (avatar.visorStyle === 'cyborg') {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(0.5, -3.5, 8, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(5, -1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(5.5, -1, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.visorStyle === 'sunglasses') {
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.roundRect(1.2, -3.2, 7.5, 3.8, 1.2);
    ctx.fill();
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else if (avatar.visorStyle === 'goggles') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-headRadius * 0.9, -2.5, headRadius * 1.4, 2.5);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(5, -1.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (avatar.visorStyle === 'neon') {
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0.5, -3, 8, 4);
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(1.5, -2, 6.5, 2);
  }

  // 3. Headgear
  const gearColor = avatar.headgearColor || '#334155';
  if (avatar.headgear === 'soldier_helmet') {
    ctx.fillStyle = gearColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -1, headRadius * 1.06, Math.PI * 0.95, -0.05, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Visor brim extending forward (+X)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-headRadius * 0.95, -2.8, headRadius * 2.1, 2.8);
  } else if (avatar.headgear === 'beret') {
    ctx.fillStyle = gearColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(-1, -headRadius * 0.8, headRadius * 1.05, headRadius * 0.45, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Gold emblem on front
    ctx.fillStyle = '#facc15';
    ctx.fillRect(2, -headRadius * 0.92, 3, 3);
  } else if (avatar.headgear === 'headband') {
    const bandColor = avatar.headgearColor === '#334155' ? '#ef4444' : gearColor;
    ctx.fillStyle = bandColor;
    ctx.fillRect(-headRadius * 0.98, -4.5, headRadius * 1.96, 3.4);
    // Flowing cloth ribbon behind head (-X)
    const flutter = Math.sin(timeSec * 11) * 2;
    ctx.beginPath();
    ctx.moveTo(-headRadius * 0.95, -3.5);
    ctx.quadraticCurveTo(-headRadius - 5, -5 + flutter, -headRadius - 10, -2 + flutter);
    ctx.lineTo(-headRadius - 9, 1 + flutter);
    ctx.closePath();
    ctx.fill();
  } else if (avatar.headgear === 'gas_mask') {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(5.5, 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(6.2, 4.2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.headgear === 'robo_visor') {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-headRadius * 0.85, -headRadius * 1.05, headRadius * 1.7, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(1, -headRadius * 0.9, 6, 2);
  } else if (avatar.headgear === 'horns') {
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    // Front swept horn
    ctx.beginPath();
    ctx.moveTo(-1, -headRadius * 0.75);
    ctx.quadraticCurveTo(3, -headRadius * 1.7, 6.5, -headRadius * 1.55);
    ctx.quadraticCurveTo(2.5, -headRadius * 1.0, 2, -headRadius * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Back horn
    ctx.beginPath();
    ctx.moveTo(-4, -headRadius * 0.65);
    ctx.quadraticCurveTo(-7, -headRadius * 1.5, -3, -headRadius * 1.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws detailed, high-tech procedural weapon along local +X axis (upright, centered near trigger grip).
 * Supports scaling and optional holographic pedestal presentation mode.
 */
export function drawEquippedWeapon(
  ctx: CanvasRenderingContext2D,
  weaponType: WeaponType,
  options?: { scale?: number; isHolo?: boolean; timeSec?: number },
): void {
  const scale = options?.scale ?? 1;
  const isHolo = Boolean(options?.isHolo);
  const timeSec = options?.timeSec ?? 0;

  ctx.save();
  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  if (isHolo) {
    ctx.shadowBlur = 10;
    ctx.shadowColor =
      weaponType === 'sniper'
        ? '#38bdf8'
        : weaponType === 'rocket'
          ? '#ef4444'
          : weaponType === 'shotgun'
            ? '#f97316'
            : weaponType === 'grenade'
              ? '#84cc16'
              : weaponType === 'rifle'
                ? '#fbbf24'
                : '#38bdf8';
  }

  switch (weaponType) {
    case 'pistol': {
      // --- TACTICAL COMBAT PISTOL ---
      // 1. Polymer Frame & Trigger Guard
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-2, -1, 12, 3);
      // Grip with stippled texture
      ctx.fillStyle = '#27272a';
      ctx.fillRect(-2, 1, 4.5, 6.8);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-1.5, 2, 3.5, 1);
      ctx.fillRect(-1.5, 4, 3.5, 1);

      // Trigger & trigger guard loop
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1;
      ctx.strokeRect(2.5, 1.2, 3.5, 4.2);
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(3.8, 2.2, 1.2, 2.2);

      // 2. Beveled Metal Slide with Cocking Serrations
      ctx.fillStyle = '#27272a';
      ctx.fillRect(-3, -4.2, 16, 4.2);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-2, -4.2, 14, 1.5); // Top slide bevel

      // Rear serrations
      ctx.fillStyle = '#09090b';
      ctx.fillRect(-2, -3.8, 1, 3);
      ctx.fillRect(0, -3.8, 1, 3);

      // 3. Under-barrel Tactical Module (Laser / Flashlight)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 0, 7.5, 2.2);
      // Cyan/Red Laser Diode
      ctx.fillStyle = isHolo ? '#38bdf8' : '#ef4444';
      ctx.beginPath();
      ctx.arc(11.5, 1.1, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // 4. Fiber-Optic Sights & Muzzle
      ctx.fillStyle = '#22c55e'; // Green front sight post
      ctx.fillRect(11, -5.2, 1.2, 1.2);
      ctx.fillStyle = '#71717a'; // Muzzle compensator tip
      ctx.fillRect(13, -3.6, 2, 2.8);
      break;
    }

    case 'shotgun': {
      // --- COMBAT SCATTERGUN (PUMP SHOTGUN) ---
      // 1. Skeletonized Tactical Stock
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-9, -2, 8, 4.5);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-11, -3, 3, 6.5); // Rubber recoil butt-pad

      // 2. Heavy Receiver
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-1, -4.2, 11, 6.2);
      // Ejection port with visible brass shell
      ctx.fillStyle = '#09090b';
      ctx.fillRect(1.5, -3.8, 5, 2.2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(2.5, -3.2, 3, 1.4);

      // Ergonomic Pistol Grip
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 1.8, 4.5, 6);

      // 3. Extended Barrel & Mag Tube
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(10, -3.8, 15, 2.6); // Main barrel
      ctx.fillStyle = '#27272a';
      ctx.fillRect(10, -0.8, 13, 2.2); // Magazine tube

      // Ribbed Vented Heat Shield on top
      ctx.fillStyle = '#0f172a';
      for (let s = 11; s <= 21; s += 2.5) {
        ctx.fillRect(s, -4.8, 1.4, 1.2);
      }

      // 4. Textured Pump Slide
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(11, -1.6, 8, 3.8);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(13, -1.6, 1.2, 3.8);
      ctx.fillRect(16, -1.6, 1.2, 3.8);

      // Heavy Muzzle Choke
      ctx.fillStyle = '#71717a';
      ctx.fillRect(24, -4.2, 2.5, 3.4);
      break;
    }

    case 'sniper': {
      // --- ELECTROMAGNETIC RAIL SNIPER ---
      // 1. Precision Stock with Cheek Riser
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-12, -3.5, 12, 5.5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-11, -4.8, 6, 1.5); // Adjustable cheek comb
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-13, -4, 2.5, 7); // Shoulder pad

      // Ergonomic Grip & Trigger assembly
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-0.5, 2, 4.2, 6.5);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(1, 4, 1.2, 3.2); // Power telemetry strip

      // 2. High-Capacity Capacitor Receiver
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -4.2, 14, 6.2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(1, -3.8, 12, 5.4);

      // 3. Segmented Rail Accelerator Barrel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(14, -3.2, 20, 3.4);

      // Glowing Magnetic Acceleration Coils (pulsing cyan)
      const coilGlow = isHolo ? 0.9 : 0.65 + Math.sin(timeSec * 8) * 0.35;
      ctx.fillStyle = `rgba(56, 189, 248, ${coilGlow})`;
      ctx.fillRect(16, -2.6, 3, 2.2);
      ctx.fillRect(21, -2.6, 3, 2.2);
      ctx.fillRect(26, -2.6, 3, 2.2);
      ctx.fillRect(30, -2.6, 3, 2.2);

      // Ionization Muzzle Brake Prongs
      ctx.fillStyle = '#64748b';
      ctx.fillRect(33, -4.2, 3.5, 5.4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(35.5, -3.2, 1.5, 3.4);

      // 4. Illuminated Optical Scope with Mounting Rings
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(3, -9.2, 14, 3.8); // Scope tube
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(16, -8.6, 2, 2.6); // Objective lens
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(2, -8.6, 1.6, 2.6); // Ocular eyepiece
      // Scope Turrets
      ctx.fillStyle = '#475569';
      ctx.fillRect(9, -10.5, 2.5, 1.5);
      // Mounting rings
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4.5, -5.4, 2, 2);
      ctx.fillRect(13.5, -5.4, 2, 2);

      // Folded Bipod under barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(22, 0.5, 8, 1.6);
      break;
    }

    case 'rocket': {
      // --- HEAVY ORDNANCE RPG LAUNCHER ---
      // 1. Reinforced Shoulder Rest & Rear Exhaust Cone
      ctx.fillStyle = '#141c28';
      ctx.fillRect(-12, -4.8, 12, 8.5);
      ctx.fillStyle = '#b45309'; // Heat-scorch exhaust bell
      ctx.beginPath();
      ctx.moveTo(-12, -5.8);
      ctx.lineTo(-16, -7.5);
      ctx.lineTo(-16, 6.2);
      ctx.lineTo(-12, 4.5);
      ctx.closePath();
      ctx.fill();

      // 2. Main Armored Launch Tube
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, -5.2, 18, 9.2);

      // Military Hazard Warning Chevrons (///)
      ctx.fillStyle = '#eab308';
      ctx.fillRect(4, -4.5, 2.2, 8);
      ctx.fillRect(8, -4.5, 2.2, 8);
      ctx.fillRect(12, -4.5, 2.2, 8);

      // Dual Tactical Grips & Trigger
      ctx.fillStyle = '#09090b';
      ctx.fillRect(3, 4, 3.8, 6.2); // Front grip
      ctx.fillRect(11, 4, 3.2, 5.5); // Rear grip

      // Optical Target-Tracking Unit on top
      ctx.fillStyle = '#111827';
      ctx.fillRect(4, -8.6, 8, 3.5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(11, -7.8, 1.5, 2);

      // 3. Heavy High-Explosive Shaped-Charge Warhead
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(18, -6.5);
      ctx.lineTo(25, -2.5);
      ctx.lineTo(28, -0.6); // Pointed nose tip
      ctx.lineTo(25, 1.5);
      ctx.lineTo(18, 5.5);
      ctx.closePath();
      ctx.fill();

      // Aerodynamic Stabilization Fins
      ctx.fillStyle = '#374151';
      ctx.fillRect(18, -8.2, 2.5, 2.5);
      ctx.fillRect(18, 4.8, 2.5, 2.5);

      // Arming indicator LED (blinking)
      const armBlink = Math.sin(timeSec * 10) > 0;
      ctx.fillStyle = armBlink ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(24, -0.6, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'grenade': {
      // --- TACTICAL FRAG GRENADE ---
      // Segmented Pineapple Hull
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.roundRect(-4, -5.5, 9, 11, 4);
      ctx.fill();
      ctx.strokeStyle = '#1a2e05';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Fragmentation Grid Seams
      ctx.fillStyle = '#365314';
      ctx.fillRect(-3, -2, 7, 1.2);
      ctx.fillRect(-3, 1, 7, 1.2);
      ctx.fillRect(0, -4.5, 1.2, 9);

      // Fuse Neck, Safety Spoon & Pull-Ring
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-1.5, -8, 4, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-3.5, -8.5, 2, 8); // Spoon
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(3.5, -7.5, 2.2, 0, Math.PI * 2); // Ring
      ctx.stroke();

      // Primed Blinking LED
      ctx.fillStyle = Math.sin(timeSec * 12) > 0 ? '#ef4444' : '#15803d';
      ctx.beginPath();
      ctx.arc(0.5, -3.5, 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'rifle':
    default: {
      // --- MODULAR ASSAULT CARBINE ---
      // 1. Skeletonized Tactical Stock
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -2.8, 8, 4.8);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-10, -4, 5, 1.4); // Cheek rest
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-11, -3.5, 2, 6); // Rubber pad

      // Ergonomic Stippled Grip
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-0.5, 1.8, 4.2, 6.2);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0, 3, 3, 1);
      ctx.fillRect(0, 5, 3, 1);

      // Trigger guard & silver trigger
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(3.5, 1.8, 3.5, 3.8);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(4.5, 2.6, 1.2, 2);

      // 2. Billet Aluminum Upper/Lower Receiver
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2, -4.2, 14, 6.2);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -3.8, 11, 2.2); // Ejection port / bolt carrier

      // Curved Banana Composite Magazine
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(7, 1.5);
      ctx.lineTo(10.5, 1.5);
      ctx.lineTo(8.5, 8.5);
      ctx.lineTo(5.2, 8.5);
      ctx.closePath();
      ctx.fill();
      // Amber Cartridge Window
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(6.8, 3.5, 2.2, 3.2);

      // 3. Vented Handguard with Picatinny Rail
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(12, -3.8, 10, 4.8);
      // M-LOK cooling slots
      ctx.fillStyle = '#090d16';
      ctx.fillRect(14, -2.4, 2.2, 1.8);
      ctx.fillRect(18, -2.4, 2.2, 1.8);

      // Barrel & Birdcage Flash Hider
      ctx.fillStyle = '#475569';
      ctx.fillRect(22, -2.6, 6, 2.4);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(26.5, -3.2, 2.5, 3.6); // Compensator

      // 4. Holographic Cyan Reflex Sight on Picatinny Top-Rail
      ctx.fillStyle = '#09090b';
      ctx.fillRect(1, -5.2, 14, 1.2); // Top Rail
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(3, -8.2, 7, 3.2); // Sight hood
      // Cyan Reticle Window
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillRect(4.5, -7.8, 4.5, 2.4);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(6.2, -6.8, 1.2, 1.2); // Center dot
      break;
    }
  }

  ctx.restore();
}
