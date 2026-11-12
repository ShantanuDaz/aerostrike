import type { Particle } from './types';

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

export function createExplosionParticles(x: number, y: number, count: number = 24): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#ef4444', '#f97316', '#fbbf24', '#71717a'];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;
    const color = colors[Math.floor(Math.random() * colors.length)];
    particles.push({
      id: `p_${nextParticleId++}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1, // slight upward bias
      radius: 2 + Math.random() * 4,
      color,
      alpha: 1,
      decay: 0.025 + Math.random() * 0.02,
    });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number = 1 / 60): Particle[] {
  if (particles.length === 0) return particles;
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;
  const drag = Math.pow(0.94, dtScale);
  const updated: Particle[] = [];

  for (const p of particles) {
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    p.vx *= drag;
    p.vy = p.vy * drag + 0.12 * dtScale; // gravity
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
