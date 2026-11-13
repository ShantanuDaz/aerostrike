import type { Bullet, ActiveWeaponPickup } from './types';
import { WEAPONS } from './weaponsConfig';
import { drawEquippedWeapon } from '../avatar/renderAvatarParts';

export function renderBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]): void {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);

    if (b.weaponType === 'sniper') {
      // Long laser beam tracer
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
    } else if (b.weaponType === 'rocket') {
      // Rocket projectile body
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle);

      // Rocket body
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-12, -3, 16, 6);
      // Red warhead tip
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(4, -3);
      ctx.lineTo(9, 0);
      ctx.lineTo(4, 3);
      ctx.fill();
      // Back thruster flame
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-12, -2);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-12, 2);
      ctx.fill();
    } else if (b.weaponType === 'shotgun') {
      // Glowing pellet
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.weaponType === 'grenade') {
      // Spinning tactical frag grenade with live blast-radius hazard circle & blinking fuse LED
      const urgent = b.lifespan < 38;
      const pulseSpeed = urgent ? 0.55 : 0.22;
      const blinkOn = Math.sin((b.maxLifespan - b.lifespan) * pulseSpeed) > 0;
      const fuseRatio = Math.max(0, Math.min(1, 1 - b.lifespan / Math.max(1, b.maxLifespan)));

      // Live blast-radius perimeter circle around armed grenade
      if (b.blastRadius > 0) {
        const radiusAlpha = urgent
          ? blinkOn
            ? 0.62
            : 0.28
          : 0.18 + fuseRatio * 0.2;
        const fillAlpha = urgent
          ? blinkOn
            ? 0.13
            : 0.05
          : 0.025 + fuseRatio * 0.035;

        ctx.fillStyle = urgent
          ? `rgba(239, 68, 68, ${fillAlpha})`
          : `rgba(132, 204, 22, ${fillAlpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, b.blastRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = urgent
          ? `rgba(248, 113, 113, ${radiusAlpha})`
          : `rgba(163, 230, 53, ${radiusAlpha})`;
        ctx.lineWidth = urgent ? 1.8 : 1.25;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, b.blastRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cardinal hazard ticks on blast radius edge
        const tickColor = urgent
          ? `rgba(251, 191, 36, ${Math.min(0.85, radiusAlpha + 0.15)})`
          : `rgba(163, 230, 53, ${radiusAlpha})`;
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = 1.5;
        for (let q = 0; q < 4; q++) {
          const a = (Math.PI / 2) * q;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(ca * (b.blastRadius - 6), sa * (b.blastRadius - 6));
          ctx.lineTo(ca * (b.blastRadius + 3), sa * (b.blastRadius + 3));
          ctx.stroke();
        }
      }

      // Inner pulsing warning ring near detonation
      if (urgent) {
        ctx.strokeStyle = blinkOn ? 'rgba(251, 191, 36, 0.55)' : 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 14 + ((38 - b.lifespan) / 38) * 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      const spin = (b.maxLifespan - b.lifespan) * 0.24;
      ctx.rotate(spin);

      // Olive / charcoal tactical casing
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.arc(0, 0, 5.1, 0, Math.PI * 2);
      ctx.fill();

      // Center charge band
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(-5.1, -1.3, 10.2, 2.6);

      // Fuse cap & spoon
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-2, -7.8, 4, 2.5);
      ctx.fillRect(2, -7.2, 2.4, 4.5);

      // Blinking fuse LED
      ctx.fillStyle = blinkOn ? (urgent ? '#ef4444' : '#fde047') : '#365314';
      ctx.beginPath();
      ctx.arc(0, -3.2, urgent ? 2.1 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard pistol / rifle bullet tracer
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle);
      ctx.fillStyle = b.weaponType === 'rifle' ? '#fde047' : '#ffffff';
      ctx.fillRect(-8, -1.5, 10, 3);
    }

    ctx.restore();
  }
}

/**
 * Draws floating weapon pickup crates with pulsing aura.
 */
/**
 * Draws floating holographic weapon pedestals displaying the actual detailed weapon vector model,
 * energy containment field, name banner, ammo capacity, and respawn countdown ring.
 */
export function renderWeaponPickups(
  ctx: CanvasRenderingContext2D,
  pickups: ActiveWeaponPickup[],
  timeSec: number = 0,
): void {
  for (const pickup of pickups) {
    const weaponConfig = WEAPONS[pickup.weaponType];
    const themeColor = weaponConfig?.color || '#38bdf8';

    // 1. Inactive State: Draw translucent wireframe base and circular cooldown countdown ring
    if (pickup.respawnTimer > 0) {
      const respawnTotal = 20; // 20s standard weapon crate respawn
      const progress = Math.max(0, Math.min(1, 1 - pickup.respawnTimer / respawnTotal));

      ctx.save();
      ctx.translate(pickup.x, pickup.y);

      // Floor dock socket
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Circular reload progress ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();

      // Countdown seconds
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(pickup.respawnTimer)}s`, 0, 3);

      ctx.restore();
      continue;
    }

    // 2. Active Ready State: Full Energized Holographic Pod
    const floatY = pickup.y - 4 + Math.sin(timeSec * 2.8 + pickup.x * 0.05) * 4;
    const pulse = 0.75 + Math.sin(timeSec * 4 + pickup.y) * 0.25;

    ctx.save();
    ctx.translate(pickup.x, floatY);
    ctx.globalAlpha = 0.8 + pulse * 0.2;

    // a. Concentric Floor Energy Rings
    ctx.save();
    ctx.translate(0, pickup.y - floatY + 18);
    const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    auraGrad.addColorStop(0, `${themeColor}44`);
    auraGrad.addColorStop(0.65, `${themeColor}15`);
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Floor projector ring with rotating notch
    ctx.strokeStyle = `${themeColor}66`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    const rotTick = timeSec * 1.8;
    const tickX = Math.cos(rotTick) * 19;
    const tickY = Math.sin(rotTick) * 6.5;
    ctx.fillStyle = themeColor;
    ctx.beginPath();
    ctx.arc(tickX, tickY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // b. Cylindrical Holographic Containment Shimmer
    const beamGrad = ctx.createLinearGradient(0, -18, 0, 16);
    beamGrad.addColorStop(0, 'transparent');
    beamGrad.addColorStop(0.35, `${themeColor}12`);
    beamGrad.addColorStop(0.75, `${themeColor}22`);
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.roundRect(-22, -20, 44, 38, 6);
    ctx.fill();

    // Subtle corner brackets for containment field
    ctx.strokeStyle = `${themeColor}88`;
    ctx.lineWidth = 1.4;
    const bLen = 5;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(-22 + bLen, -20);
    ctx.lineTo(-22, -20);
    ctx.lineTo(-22, -20 + bLen);
    // Top-right
    ctx.moveTo(22 - bLen, -20);
    ctx.lineTo(22, -20);
    ctx.lineTo(22, -20 + bLen);
    // Bottom-left
    ctx.moveTo(-22 + bLen, 18);
    ctx.lineTo(-22, 18);
    ctx.lineTo(-22, 18 - bLen);
    // Bottom-right
    ctx.moveTo(22 - bLen, 18);
    ctx.lineTo(22, 18);
    ctx.lineTo(22, 18 - bLen);
    ctx.stroke();

    // c. The Actual Weapon Vector Model (Floating, Bobbing & Slightly Angled)
    ctx.save();
    ctx.translate(-2, 0);
    // Gentle floating tilt
    ctx.rotate(Math.sin(timeSec * 2.2) * 0.08 - 0.04);
    drawEquippedWeapon(ctx, pickup.weaponType, {
      scale: 1.32,
      isHolo: true,
      timeSec,
    });
    ctx.restore();

    // d. Floating Tactical Weapon HUD Tag above weapon
    const tagY = -27;
    const ammoLabel =
      weaponConfig.maxAmmo === Infinity ? '∞' : `${weaponConfig.maxAmmo} RDS`;
    const labelText = weaponConfig.name.toUpperCase();

    ctx.font = 'bold 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    const textWidth = ctx.measureText(labelText).width;
    const boxW = Math.max(54, textWidth + 14);

    // Tag background
    ctx.fillStyle = 'rgba(6, 11, 23, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, tagY - 6.5, boxW, 13, 3);
    ctx.fill();

    ctx.strokeStyle = `${themeColor}99`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glowing weapon title
    ctx.fillStyle = themeColor;
    ctx.textAlign = 'center';
    ctx.fillText(labelText, 0, tagY + 3);

    // Sub-pill for ammo count
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-16, tagY + 8.5, 32, 9, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 7px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(ammoLabel, 0, tagY + 15.5);

    ctx.restore();
  }
}
