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
