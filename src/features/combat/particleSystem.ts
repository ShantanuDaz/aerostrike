import type { BlastVisualEffect, Particle } from './types';

let nextParticleId = 0;

export function createSparks(x: number, y: number, count: number = 6, color: string = '#fbbf24'): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      id: `p_${nextParticleId++}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + Math.random() * 1.5,
      color,
      alpha: 1,
      decay: 0.04 + Math.random() * 0.03,
    });
  }
  return particles;
}

export function createDirectionalSparks(
  x: number,
  y: number,
  nx: number,
  ny: number,
  count: number = 7,
  color: string = '#fbbf24',
): Particle[] {
  const baseAngle = Math.atan2(ny, nx);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * 1.65;
    const speed = 1.8 + Math.random() * 3.8;
    particles.push({
      id: `p_${nextParticleId++}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.3 + Math.random() * 1.4,
      color,
      alpha: 1,
      decay: 0.045 + Math.random() * 0.03,
    });
  }
  return particles;
}

export function createExplosionParticles(
  x: number,
  y: number,
  count: number = 36,
  shrapnelAccent?: string,
): Particle[] {
  const particles: Particle[] = [];
  const fireColors = ['#ffffff', '#fef08a', '#fbbf24', '#f97316', '#ef4444'];
  const smokeColors = ['#475569', '#334155', '#1e293b'];

  const fireCount = Math.max(12, Math.round(count * 0.52));
  const shrapnelCount = Math.max(8, Math.round(count * 0.28));
  const smokeCount = Math.max(6, count - fireCount - shrapnelCount);

  // 1. Bright core fireball & hot plasma chunks
  for (let i = 0; i < fireCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 7.8;
    const color = fireColors[Math.floor(Math.random() * fireColors.length)];
    particles.push({
      id: `p_${nextParticleId++}`,
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      radius: 2.5 + Math.random() * 4.8,
      color,
      alpha: 1,
      decay: 0.028 + Math.random() * 0.022,
      gravity: 0.08,
      drag: 0.93,
    });
  }

  // 2. High-velocity shrapnel sparks radiating across blast zone
  for (let i = 0; i < shrapnelCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6.5 + Math.random() * 6.5;
    const color =
      shrapnelAccent && i % 2 === 0 ? shrapnelAccent : i % 3 === 0 ? '#ffffff' : '#fde047';
    particles.push({
      id: `p_${nextParticleId++}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.8,
      radius: 1.4 + Math.random() * 1.8,
      color,
      alpha: 1,
      decay: 0.036 + Math.random() * 0.024,
      gravity: 0.14,
      drag: 0.92,
    });
  }

  // 3. Billowing dark smoke plumes that linger slightly longer
  for (let i = 0; i < smokeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 2.8;
    const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
    particles.push({
      id: `p_${nextParticleId++}`,
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      radius: 5.5 + Math.random() * 7.5,
      color,
      alpha: 0.78,
      decay: 0.015 + Math.random() * 0.012,
      gravity: -0.025, // slight thermal updraft
      drag: 0.95,
    });
  }

  return particles;
}

export function updateParticles(particles: Particle[], dt: number = 1 / 60): Particle[] {
  if (particles.length === 0) return particles;
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;
  const updated: Particle[] = [];

  for (const p of particles) {
    const drag = Math.pow(p.drag ?? 0.94, dtScale);
    const gravity = p.gravity ?? 0.12;
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    p.vx *= drag;
    p.vy = p.vy * drag + gravity * dtScale;
    p.alpha -= p.decay * dtScale;

    if (p.alpha > 0) {
      updated.push(p);
    }
  }

  return updated;
}

export function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Renders dramatic expanding shockwaves, thermal fireball bloom, and explicit blast-radius boundary rings.
 */
export function renderBlastEffects(
  ctx: CanvasRenderingContext2D,
  effects: BlastVisualEffect[],
): void {
  for (let i = 0; i < effects.length; i++) {
    const fx = effects[i];
    const progress = Math.max(0, Math.min(1, fx.age / Math.max(0.001, fx.duration)));
    const inv = 1 - progress;
    const isFrag = fx.weaponType === 'grenade';

    ctx.save();
    ctx.translate(fx.x, fx.y);

    // 1. Soot/scorch shadow at center that fades out slowly
    const scorchAlpha = inv * 0.38;
    const scorchGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, fx.radius * 0.62);
    scorchGrad.addColorStop(0, `rgba(15, 23, 42, ${scorchAlpha})`);
    scorchGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(0, 0, fx.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concussive thermal flash fill across full blastRadius
    if (progress < 0.65) {
      const flashT = progress / 0.65;
      const flashAlpha = (1 - flashT) * (1 - flashT) * 0.55;
      const currentFillR = Math.max(10, fx.radius * (0.28 + 0.72 * Math.min(1, progress * 3.2)));
      const fireGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, currentFillR);
      fireGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.95, flashAlpha * 1.7)})`);
      fireGrad.addColorStop(0.28, `rgba(253, 224, 71, ${flashAlpha * 1.25})`);
      fireGrad.addColorStop(
        0.65,
        isFrag
          ? `rgba(249, 115, 22, ${flashAlpha * 0.85})`
          : `rgba(239, 68, 68, ${flashAlpha * 0.85})`,
      );
      fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(0, 0, currentFillR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Fast expanding shockwave ring racing to exact blastRadius
    const waveEase = 1 - Math.pow(1 - Math.min(1, progress * 1.55), 3);
    const waveR = Math.max(8, fx.radius * waveEase);
    const waveAlpha = Math.max(0, 1 - progress * 1.25);
    if (waveAlpha > 0.02) {
      ctx.strokeStyle = isFrag
        ? `rgba(254, 240, 138, ${waveAlpha * 0.92})`
        : `rgba(253, 186, 116, ${waveAlpha * 0.92})`;
      ctx.lineWidth = Math.max(1.5, 6 * (1 - progress));
      ctx.beginPath();
      ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      ctx.stroke();

      // Secondary inner heat ring
      if (waveR > 20) {
        ctx.strokeStyle = isFrag
          ? `rgba(163, 230, 53, ${waveAlpha * 0.65})`
          : `rgba(239, 68, 68, ${waveAlpha * 0.65})`;
        ctx.lineWidth = Math.max(1, 3 * (1 - progress));
        ctx.beginPath();
        ctx.arc(0, 0, waveR * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 4. Explicit outer blast-radius boundary indicator so the exact AoE is readable
    const ringAlpha = inv * inv * 0.68;
    if (ringAlpha > 0.02) {
      ctx.strokeStyle = isFrag
        ? `rgba(248, 113, 113, ${ringAlpha})`
        : `rgba(251, 146, 60, ${ringAlpha})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
