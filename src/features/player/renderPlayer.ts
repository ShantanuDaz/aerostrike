import type { Player } from './types';
import type { WeaponType } from '../combat/types';
import type { GameMode } from '../ctf/types';
import { renderAvatar } from '../avatar/renderAvatar';
import { renderCarriedFlag } from '../ctf/renderFlags';

export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  timeSec: number = 0,
  isBoosting: boolean = false,
  weaponType: WeaponType = 'rifle',
  isLocal: boolean = false,
  cameraZoom: number = 1,
  highContrast: boolean = false,
  mode: GameMode = 'ctf',
): void {
  // If player is dead, ragdoll physics renders their body — draw subtle respawn tag for remote teammates/enemies
  if (player.isDead) {
    if (!isLocal && player.respawnTimer > 0) {
      ctx.save();
      ctx.translate(player.x, player.y - 24);
      const hudInvScale =
        cameraZoom < 0.9 ? Math.min(1.42, 0.96 / Math.max(0.55, cameraZoom)) : 1;
      if (hudInvScale !== 1) {
        ctx.scale(hudInvScale, hudInvScale);
      }
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
      ctx.textAlign = 'center';
      ctx.fillText(`RESPAWN ${Math.ceil(player.respawnTimer)}s`, 0, 0);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  // 1. Invulnerability Spawn Shield Glow (vertical oval fitting humanoid silhouette)
  if (player.invulnerableTimer > 0) {
    ctx.save();
    const pulse = Math.sin(timeSec * 12) * 2;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, player.radius + 7 + pulse, player.radius * 1.7 + 5 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 1b. Air-Dash Thruster Streaks
  if ((player.dashActiveTimer ?? 0) > 0) {
    ctx.save();
    const dir = player.vx >= 0 ? -1 : 1;
    ctx.strokeStyle = player.team === 'blue' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(251, 113, 133, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dir * 8, -12);
    ctx.lineTo(dir * 32, -12);
    ctx.moveTo(dir * 10, 0);
    ctx.lineTo(dir * 38, 0);
    ctx.moveTo(dir * 8, 12);
    ctx.lineTo(dir * 30, 12);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Carried Flag (waving from upper back, CTF only)
  if (mode === 'ctf' && player.carryingFlag) {
    const enemyTeam = player.team === 'blue' ? 'red' : 'blue';
    renderCarriedFlag(ctx, enemyTeam, timeSec);
  }

  // 3. Articulated Exo-Soldier Avatar
  renderAvatar(ctx, player.avatar, {
    aimAngle: player.aimAngle,
    radius: player.radius,
    isBoosting,
    team: mode === 'ffa' ? undefined : player.team,
    healthPercent: player.health / player.maxHealth,
    fuelPercent: player.boostFuel / player.maxFuel,
    showHUD: !isLocal,
    cameraZoom,
    highContrast,
    vx: player.vx,
    vy: player.vy,
    isGrounded: Boolean(player.isGrounded),
    timeSec,
    weaponType,
  });

  ctx.restore();
}
