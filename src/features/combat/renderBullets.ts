import type { Bullet, ActiveWeaponPickup } from './types';
import { WEAPONS } from './weaponsConfig';

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
export function renderWeaponPickups(
  ctx: CanvasRenderingContext2D,
  pickups: ActiveWeaponPickup[],
  timeSec: number = 0,
): void {
  for (const pickup of pickups) {
    if (pickup.respawnTimer > 0) continue; // Inactive, waiting respawn

    const floatY = pickup.y + Math.sin(timeSec * 3 + pickup.x) * 4;
    const weaponConfig = WEAPONS[pickup.weaponType];

    ctx.save();
    ctx.translate(pickup.x, floatY);

    // Glowing ground aura
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Weapon Crate Box
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-16, -12, 32, 24, 4);
    ctx.fill();

    ctx.strokeStyle = weaponConfig?.color || '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Weapon Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pickup.weaponType.toUpperCase(), 0, 4);

    ctx.restore();
  }
}
