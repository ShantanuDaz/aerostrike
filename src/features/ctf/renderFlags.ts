import type { Flag } from './types';

/**
 * Draws procedural waving flags and base pedestals on the map.
 */
export function renderFlags(
  ctx: CanvasRenderingContext2D,
  flags: Flag[],
  timeSec: number = 0,
): void {
  for (const flag of flags) {
    const isBlue = flag.team === 'blue';
    const mainColor = isBlue ? '#3b82f6' : '#ef4444';
    const lightColor = isBlue ? '#93c5fd' : '#fca5a5';

    // 1. Draw Flag Pedestal Base (Always at home base)
    ctx.save();
    ctx.translate(flag.baseX, flag.baseY + 36);
    // Glowing ground circle
    ctx.fillStyle = isBlue ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Metallic pedestal block
    ctx.fillStyle = '#334155';
    ctx.fillRect(-16, -6, 32, 8);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-16, -6, 32, 8);
    ctx.restore();

    // If carried by a player, the flag is drawn attached to carrier in player render loop
    if (flag.status === 'carried') {
      continue;
    }

    // 2. Draw Flag in World (At Base or Dropped)
    ctx.save();
    ctx.translate(flag.x, flag.y);

    // Dropped countdown timer circle
    if (flag.status === 'dropped') {
      const radius = 22;
      const progress = flag.returnTimer / 20; // 0 to 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 16, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = mainColor;
      ctx.beginPath();
      ctx.arc(0, 16, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();

      // Timer text
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(flag.returnTimer)}s`, 0, -8);
    }

    // Flag Pole (metallic cylinder)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-2, 0, 4, 38);
    // Gold finial sphere at top
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Waving Cloth Flag (Bezier curve oscillation)
    const wave1 = Math.sin(timeSec * 7) * 4;
    const wave2 = Math.cos(timeSec * 8) * 3;

    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.quadraticCurveTo(14 + wave1, 6, 26, 6 + wave2);
    ctx.lineTo(26, 22 + wave2);
    ctx.quadraticCurveTo(14 + wave1, 22, 2, 18);
    ctx.closePath();
    ctx.fill();

    // Inner cloth highlight stripe
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.quadraticCurveTo(14 + wave1, 10, 26, 10 + wave2);
    ctx.lineTo(26, 14 + wave2);
    ctx.quadraticCurveTo(14 + wave1, 14, 2, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Draws the carried flag waving from a carrier's back.
 */
export function renderCarriedFlag(
  ctx: CanvasRenderingContext2D,
  team: 'blue' | 'red',
  timeSec: number = 0,
): void {
  const isBlue = team === 'blue';
  const mainColor = isBlue ? '#3b82f6' : '#ef4444';
  const lightColor = isBlue ? '#93c5fd' : '#fca5a5';

  ctx.save();
  ctx.translate(-8, -12); // offset to upper back

  // Pole angled backwards
  ctx.rotate(-0.35);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-1.5, -24, 3, 26);

  // Waving flag
  const wave = Math.sin(timeSec * 9) * 4;
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(1.5, -24);
  ctx.quadraticCurveTo(12 + wave, -20, 22, -18);
  ctx.lineTo(22, -8);
  ctx.quadraticCurveTo(12 + wave, -10, 1.5, -14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = lightColor;
  ctx.fillRect(1.5, -20, 20, 3);

  ctx.restore();
}
