import { useEffect, useRef } from 'react';
import type React from 'react';
import type { AvatarConfig } from '../../avatar/types';
import { renderAvatar } from '../../avatar/renderAvatar';
import type { WeaponType } from '../../combat/types';
import { WEAPONS } from '../../combat/weaponsConfig';
import { sounds } from '../../audio/soundEngine';

interface HangarTracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface HangarSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface StarDot {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

interface OrbitalHangarCanvasProps {
  avatar: AvatarConfig;
  defaultWeapon: WeaponType;
}

export function OrbitalHangarCanvas({ avatar, defaultWeapon }: OrbitalHangarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const activeDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const tracersRef = useRef<HangarTracer[]>([]);
  const sparksRef = useRef<HangarSpark[]>([]);
  const soldierPosRef = useRef<{ x: number; y: number; aimAngle: number }>({
    x: 240,
    y: 260,
    aimAngle: -0.1,
  });

  const stageStateRef = useRef({ avatar, defaultWeapon });
  useEffect(() => {
    stageStateRef.current = { avatar, defaultWeapon };
  }, [avatar, defaultWeapon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: StarDot[] = Array.from({ length: 58 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      speed: 0.004 + Math.random() * 0.014,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handlePointerMoveGlobal = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || activeDragRef.current?.pointerId === e.pointerId) {
        pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMoveGlobal, { passive: true });

    let animId = 0;
    let lastTime = performance.now();
    let timeSec = 0;
    let smoothAim = -0.08;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      timeSec += dt;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isShortLandscape = h < 520 && w >= h;
      const isPortrait = !isShortLandscape && w < 640;
      const { avatar: currentAvatar, defaultWeapon: currentWeapon } = stageStateRef.current;

      // 1. Deep Space Orbital Backdrop
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h);

      // Subtle atmospheric horizon glow
      const bgGlow = ctx.createRadialGradient(
        isPortrait ? w * 0.5 : w * 0.34,
        isPortrait ? h * 0.37 : h * 0.47,
        20,
        isPortrait ? w * 0.5 : w * 0.34,
        isPortrait ? h * 0.37 : h * 0.47,
        Math.max(w, h) * 0.65,
      );
      bgGlow.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
      bgGlow.addColorStop(0.5, 'rgba(14, 30, 64, 0.16)');
      bgGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // Drifting orbital stars
      for (const s of stars) {
        s.x = (s.x + s.speed * dt) % 1;
        const twinkle = 0.7 + Math.sin(timeSec * 2.2 + s.y * 20) * 0.3;
        ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.78, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Faint tactical coordinate grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
      ctx.lineWidth = 1;
      const gridStep = 56;
      for (let gx = 0; gx < w; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Hangar Architecture Silhouette (Upper Trusses & Floor Deck)
      const deckY = isPortrait ? h * 0.56 : h * 0.72;
      ctx.save();
      ctx.fillStyle = 'rgba(9, 15, 30, 0.78)';
      ctx.fillRect(0, deckY, w, h - deckY);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, deckY);
      ctx.lineTo(w, deckY);
      ctx.stroke();

      // Perspective deck lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.4 + i * 75, deckY);
        ctx.lineTo(w * 0.4 + i * 190, h);
        ctx.stroke();
      }

      // Upper hangar framing struts
      ctx.fillStyle = 'rgba(11, 18, 35, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.16, 0);
      ctx.lineTo(0, h * 0.22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.84, 0);
      ctx.lineTo(w, h * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Drop-Bay Pedestal & Volumetric Spotlight
      const stageX = isPortrait ? w * 0.5 : w * 0.32;
      const stageY = isPortrait ? h * 0.38 : isShortLandscape ? h * 0.45 : h * 0.47;
      const soldierRadius = isShortLandscape
        ? Math.max(24, Math.min(34, h * 0.086))
        : isPortrait
          ? Math.max(28, Math.min(40, w * 0.095))
          : Math.max(38, Math.min(52, Math.min(w, h) * 0.068));
      const padY = stageY + soldierRadius * 2.15;

      // Spotlight cone from ceiling
      ctx.save();
      const cone = ctx.createLinearGradient(stageX, 0, stageX, padY);
      cone.addColorStop(0, 'rgba(0, 240, 255, 0.02)');
      cone.addColorStop(0.6, 'rgba(0, 240, 255, 0.09)');
      cone.addColorStop(1, 'rgba(0, 240, 255, 0.18)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(stageX - 48, 0);
      ctx.lineTo(stageX + 48, 0);
      ctx.lineTo(stageX + 145, padY + 8);
      ctx.lineTo(stageX - 145, padY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pedestal platform
      ctx.save();
      const padW = isPortrait ? 108 : isShortLandscape ? 105 : 148;
      const padH = isPortrait || isShortLandscape ? 18 : 28;
      ctx.fillStyle = '#0b1326';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(stageX, padY, padW, padH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner pulsing holographic ring
      const ringPulse = 0.65 + Math.sin(timeSec * 3.2) * 0.35;
      ctx.strokeStyle = `rgba(56, 189, 248, ${ringPulse * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -timeSec * 22;
      ctx.beginPath();
      ctx.ellipse(stageX, padY, padW * 0.72, padH * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Ambient pad thruster sparks
      if (Math.random() < 0.28) {
        sparksRef.current.push({
          x: stageX + (Math.random() - 0.5) * 44,
          y: stageY + soldierRadius * 0.9,
          vx: (Math.random() - 0.5) * 28,
          vy: -25 - Math.random() * 45,
          life: 0.7 + Math.random() * 0.6,
          size: 1.5 + Math.random() * 2,
          color: Math.random() > 0.3 ? '#38bdf8' : '#f59e0b',
        });
      }

      // 4. Aim Angle Tracking
      const ptr = pointerRef.current;
      let targetAim = Math.sin(timeSec * 0.8) * 0.32 - 0.08;
      if (ptr.active) {
        targetAim = Math.atan2(ptr.y - stageY, ptr.x - stageX);
      }
      let delta = targetAim - smoothAim;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      smoothAim += delta * Math.min(1, dt * 10);

      const hoverOffsetY = Math.sin(timeSec * 2.4) * 5;
      soldierPosRef.current = {
        x: stageX,
        y: stageY + hoverOffsetY,
        aimAngle: smoothAim,
      };

      // 5. Render Hero Exo-Soldier
      ctx.save();
      ctx.translate(stageX, stageY + hoverOffsetY);
      renderAvatar(ctx, currentAvatar, {
        aimAngle: smoothAim,
        radius: soldierRadius,
        isBoosting: true,
        showHUD: false,
        vx: 0,
        vy: Math.cos(timeSec * 2.4) * 0.6,
        isGrounded: false,
        timeSec,
        weaponType: currentWeapon,
      });
      ctx.restore();

      // 6. Update & Draw Sparks + Hangar Test Tracers
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const sp = sparksRef.current[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
        if (sp.life <= 0) {
          sparksRef.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, sp.life));
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = tracersRef.current.length - 1; i >= 0; i--) {
        const tr = tracersRef.current[i];
        const prevX = tr.x;
        const prevY = tr.y;
        tr.x += tr.vx * dt;
        tr.y += tr.vy * dt;
        tr.life -= dt;
        if (tr.life <= 0 || tr.x < -50 || tr.x > w + 50 || tr.y < -50 || tr.y > h + 50) {
          tracersRef.current.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = tr.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(tr.x, tr.y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMoveGlobal);
    };
  }, []);

  const fireStageTestShot = (clientX: number, clientY: number) => {
    const pos = soldierPosRef.current;
    const angle = Math.atan2(clientY - pos.y, clientX - pos.x);
    pointerRef.current = { x: clientX, y: clientY, active: true };
    const wCfg = WEAPONS[defaultWeapon];
    sounds.playWeaponSound(defaultWeapon);

    const count = wCfg.pellets;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.08 : 0;
      const a = angle + spread;
      const spd = 950;
      tracersRef.current.push({
        x: pos.x + Math.cos(a) * 34,
        y: pos.y + Math.sin(a) * 34,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.75,
        color: wCfg.color,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      sparksRef.current.push({
        x: pos.x + Math.cos(angle) * 36,
        y: pos.y + Math.sin(angle) * 36,
        vx: Math.cos(a) * (120 + Math.random() * 140),
        vy: Math.sin(a) * (120 + Math.random() * 140),
        life: 0.35,
        size: 2.2,
        color: '#fde047',
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
    activeDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = activeDragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 12) {
        drag.moved = true;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = activeDragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const wasTap = !drag.moved;
      activeDragRef.current = null;
      if (wasTap) {
        fireStageTestShot(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeDragRef.current?.pointerId === e.pointerId) {
      activeDragRef.current = null;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="fixed inset-0 w-full h-full block cursor-crosshair z-0 touch-none"
      title="Move or drag to aim • Tap hangar bay to test-fire weapon"
    />
  );
}
