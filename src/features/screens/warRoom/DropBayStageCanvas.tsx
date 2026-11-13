import { useEffect, useRef } from 'react';
import type React from 'react';
import { DEFAULT_AVATAR } from '../../avatar/avatarStore';
import { renderAvatar } from '../../avatar/renderAvatar';
import { sounds } from '../../audio/soundEngine';
import type { WeaponType } from '../../combat/types';
import { WEAPONS } from '../../combat/weaponsConfig';
import type { Team } from '../../ctf/types';
import type { RosterMember } from '../../network/types';

interface StageStar {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

interface StageSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface StageTracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface DropBayStageCanvasProps {
  blueMembers: RosterMember[];
  redMembers: RosterMember[];
  localPlayerId: string;
  defaultWeapon: WeaponType;
  localTeam: Team;
  is3DMode?: boolean;
  mapId?: string;
}

export function DropBayStageCanvas({
  blueMembers,
  redMembers,
  localPlayerId,
  defaultWeapon,
  localTeam,
  is3DMode = false,
  mapId,
}: DropBayStageCanvasProps) {
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
  const sparksRef = useRef<StageSpark[]>([]);
  const tracersRef = useRef<StageTracer[]>([]);
  const localBayPosRef = useRef<{ x: number; y: number; team: Team }>({
    x: 240,
    y: 220,
    team: localTeam,
  });

  const stageStateRef = useRef({
    blueMembers,
    redMembers,
    localPlayerId,
    defaultWeapon,
    localTeam,
    is3DMode,
    mapId,
  });

  useEffect(() => {
    stageStateRef.current = {
      blueMembers,
      redMembers,
      localPlayerId,
      defaultWeapon,
      localTeam,
      is3DMode,
      mapId,
    };
  }, [blueMembers, redMembers, localPlayerId, defaultWeapon, localTeam, is3DMode, mapId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: StageStar[] = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      speed: 0.004 + Math.random() * 0.012,
      alpha: 0.18 + Math.random() * 0.55,
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
    let smoothLocalAim = 0;

    const drawPedestal = (
      cx: number,
      cy: number,
      padW: number,
      padH: number,
      primaryRgb: string,
      ringColor: string,
    ) => {
      ctx.save();
      const cone = ctx.createLinearGradient(cx, 0, cx, cy);
      cone.addColorStop(0, `rgba(${primaryRgb}, 0.01)`);
      cone.addColorStop(0.6, `rgba(${primaryRgb}, 0.07)`);
      cone.addColorStop(1, `rgba(${primaryRgb}, 0.16)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - padW * 0.34, 0);
      ctx.lineTo(cx + padW * 0.34, 0);
      ctx.lineTo(cx + padW * 1.05, cy + 6);
      ctx.lineTo(cx - padW * 1.05, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#091122';
      ctx.strokeStyle = `rgba(${primaryRgb}, 0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, padW, padH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const pulse = 0.65 + Math.sin(timeSec * 3.1) * 0.35;
      ctx.strokeStyle = ringColor;
      ctx.globalAlpha = 0.65 * pulse;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -timeSec * 20;
      ctx.beginPath();
      ctx.ellipse(cx, cy, padW * 0.72, padH * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const drawPilotTag = (
      px: number,
      py: number,
      radius: number,
      member: RosterMember,
      isLocal: boolean,
      teamColor: string,
    ) => {
      const label = (member.callsign || 'PILOT').slice(0, 12);
      const prefix = member.isHost ? '★ ' : '';
      const suffix = isLocal ? ' [YOU]' : '';
      const fullText = `${prefix}${label}${suffix}`;

      ctx.save();
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textWidth = ctx.measureText(fullText).width;
      const boxW = textWidth + 20;
      const boxH = 18;
      const tagY = py - radius * 2.0 - 12;

      ctx.fillStyle = 'rgba(6, 9, 19, 0.88)';
      ctx.strokeStyle = isLocal ? teamColor : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px - boxW / 2, tagY, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = member.isReady ? '#34d399' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(px - boxW / 2 + 7, tagY + boxH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isLocal ? '#ffffff' : '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fullText, px - boxW / 2 + 13, tagY + boxH / 2 + 0.5);
      ctx.restore();
    };

    const drawHolodeck3DMatrix = (
      cx: number,
      cy: number,
      w: number,
      isPortrait: boolean,
      currentMapId?: string,
    ) => {
      ctx.save();
      const yaw = timeSec * 0.4;
      const pitch = 0.52;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const holoScale = isPortrait ? Math.min(w * 0.15, 68) : Math.min(w * 0.13, 105);

      const project = (x: number, y: number, z: number) => {
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        const ry = y * cosP - rz * sinP;
        const rz2 = y * sinP + rz * cosP;
        const dist = 3.0;
        const pers = dist / (dist + rz2);
        return {
          px: cx + rx * holoScale * pers,
          py: cy + ry * holoScale * pers,
          pers,
        };
      };

      // 1. Floor grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
      ctx.lineWidth = 1;
      const gridN = 3;
      for (let i = -gridN; i <= gridN; i++) {
        const u = i / gridN;
        const p1 = project(u, 0.25, -1);
        const p2 = project(u, 0.25, 1);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();

        const p3 = project(-1, 0.25, u);
        const p4 = project(1, 0.25, u);
        ctx.beginPath();
        ctx.moveTo(p3.px, p3.py);
        ctx.lineTo(p4.px, p4.py);
        ctx.stroke();
      }

      // 2. Wireframe bounding box
      const corners = [
        [-1, -0.25, -1], [1, -0.25, -1], [1, -0.25, 1], [-1, -0.25, 1],
        [-1, 0.25, -1], [1, 0.25, -1], [1, 0.25, 1], [-1, 0.25, 1],
      ].map(([x, y, z]) => project(x, y, z));

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(corners[0].px, corners[0].py);
      ctx.lineTo(corners[1].px, corners[1].py);
      ctx.lineTo(corners[2].px, corners[2].py);
      ctx.lineTo(corners[3].px, corners[3].py);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(corners[4].px, corners[4].py);
      ctx.lineTo(corners[5].px, corners[5].py);
      ctx.lineTo(corners[6].px, corners[6].py);
      ctx.lineTo(corners[7].px, corners[7].py);
      ctx.closePath();
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(corners[i].px, corners[i].py);
        ctx.lineTo(corners[i + 4].px, corners[i + 4].py);
        ctx.stroke();
      }

      // 3. Spawn Barriers
      const b1 = project(-1, 0.25, -0.65);
      const b2 = project(1, 0.25, -0.65);
      const b3 = project(1, -0.1, -0.65);
      const b4 = project(-1, -0.1, -0.65);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.moveTo(b1.px, b1.py);
      ctx.lineTo(b2.px, b2.py);
      ctx.lineTo(b3.px, b3.py);
      ctx.lineTo(b4.px, b4.py);
      ctx.closePath();
      ctx.fill();

      const r1 = project(-1, 0.25, 0.65);
      const r2 = project(1, 0.25, 0.65);
      const r3 = project(1, -0.1, 0.65);
      const r4 = project(-1, -0.1, 0.65);
      ctx.fillStyle = 'rgba(251, 113, 133, 0.15)';
      ctx.beginPath();
      ctx.moveTo(r1.px, r1.py);
      ctx.lineTo(r2.px, r2.py);
      ctx.lineTo(r3.px, r3.py);
      ctx.lineTo(r4.px, r4.py);
      ctx.closePath();
      ctx.fill();

      // 4. Site A Marker
      const siteAPos = project(0.55, 0.05, -0.1);
      const pulseA = 0.7 + Math.sin(timeSec * 4.0) * 0.3;
      ctx.strokeStyle = '#34d399';
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(siteAPos.px, siteAPos.py, 3.5 * siteAPos.pers, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(siteAPos.px, siteAPos.py, (7 + pulseA * 5) * siteAPos.pers, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'center';
      ctx.fillText('SITE A', siteAPos.px, siteAPos.py - 9 * siteAPos.pers);

      // 5. Site B Marker
      const siteBPos = project(-0.55, 0.05, -0.1);
      const pulseB = 0.7 + Math.sin(timeSec * 4.0 + Math.PI) * 0.3;
      ctx.strokeStyle = '#fbbf24';
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(siteBPos.px, siteBPos.py, 3.5 * siteBPos.pers, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(siteBPos.px, siteBPos.py, (7 + pulseB * 5) * siteBPos.pers, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.fillText('SITE B', siteBPos.px, siteBPos.py - 9 * siteBPos.pers);

      // 6. Hologram Scanning Beam Line
      const scanPhase = (Math.sin(timeSec * 2.2) + 1) * 0.5;
      const scanY = -0.25 + scanPhase * 0.5;
      const sp1 = project(-1, scanY, -1);
      const sp2 = project(1, scanY, -1);
      const sp3 = project(1, scanY, 1);
      const sp4 = project(-1, scanY, 1);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sp1.px, sp1.py);
      ctx.lineTo(sp2.px, sp2.py);
      ctx.lineTo(sp3.px, sp3.py);
      ctx.lineTo(sp4.px, sp4.py);
      ctx.closePath();
      ctx.stroke();

      // Elevated Skybridge for Holodeck Bravo
      if (currentMapId === 'holodeck-bravo') {
        const c1 = project(-0.2, 0.45, -0.6);
        const c2 = project(0.2, 0.45, -0.6);
        const c3 = project(0.2, 0.45, 0.6);
        const c4 = project(-0.2, 0.45, 0.6);
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(c1.px, c1.py);
        ctx.lineTo(c2.px, c2.py);
        ctx.lineTo(c3.px, c3.py);
        ctx.lineTo(c4.px, c4.py);
        ctx.closePath();
        ctx.stroke();
      }

      // 7. Tactical Subtitle Badge
      ctx.font = '900 italic 9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = currentMapId === 'holodeck-bravo' ? 'rgba(192, 132, 252, 0.95)' : 'rgba(34, 211, 238, 0.9)';
      ctx.textAlign = 'center';
      const matrixTitle = currentMapId === 'holodeck-bravo' ? 'HOLODECK BRAVO // NEON NEXUS' : 'HOLODECK ALPHA // VECTOR FACILITY';
      ctx.fillText(matrixTitle, cx, cy + holoScale * 0.75 + 14);

      ctx.font = 'bold 8px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.fillText('3D TACTICAL SIMULATION // ZERO ASSETS PROTOCOL', cx, cy + holoScale * 0.75 + 26);
      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      timeSec += dt;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isShortLandscape = h < 520 && w >= h;
      const isPortrait = !isShortLandscape && w < 640;

      const {
        blueMembers: blues,
        redMembers: reds,
        localPlayerId: myId,
        defaultWeapon: myWeapon,
        localTeam: myTeam,
        is3DMode,
        mapId: currentMapId,
      } = stageStateRef.current;

      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h);

      const blueBayX = isPortrait ? w * 0.28 : w * 0.33;
      const redBayX = isPortrait ? w * 0.72 : w * 0.67;
      const bayCenterY = isShortLandscape
        ? h * 0.49
        : isPortrait
          ? h * 0.44
          : h * 0.46;

      const blueGlow = ctx.createRadialGradient(
        blueBayX,
        bayCenterY,
        15,
        blueBayX,
        bayCenterY,
        Math.max(w, h) * 0.44,
      );
      blueGlow.addColorStop(0, 'rgba(0, 240, 255, 0.14)');
      blueGlow.addColorStop(0.6, 'rgba(14, 30, 64, 0.12)');
      blueGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = blueGlow;
      ctx.fillRect(0, 0, w, h);

      const redGlow = ctx.createRadialGradient(
        redBayX,
        bayCenterY,
        15,
        redBayX,
        bayCenterY,
        Math.max(w, h) * 0.44,
      );
      redGlow.addColorStop(0, 'rgba(255, 0, 85, 0.12)');
      redGlow.addColorStop(0.6, 'rgba(48, 12, 30, 0.10)');
      redGlow.addColorStop(1, 'rgba(6, 9, 19, 0)');
      ctx.fillStyle = redGlow;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.x = (s.x + s.speed * dt) % 1;
        const twinkle = 0.7 + Math.sin(timeSec * 2.2 + s.y * 20) * 0.3;
        ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.76, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.032)';
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

      const soldierRadius = isShortLandscape
        ? Math.max(20, Math.min(28, h * 0.068))
        : isPortrait
          ? Math.max(22, Math.min(30, w * 0.072))
          : Math.max(30, Math.min(44, Math.min(w, h) * 0.056));
      const padY = bayCenterY + soldierRadius * 2.15;
      const deckY = Math.max(padY - 4, bayCenterY + soldierRadius * 1.9);

      ctx.save();
      ctx.fillStyle = 'rgba(9, 15, 30, 0.8)';
      ctx.fillRect(0, deckY, w, h - deckY);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, deckY);
      ctx.lineTo(w, deckY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.055)';
      for (let i = -7; i <= 7; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 75, deckY);
        ctx.lineTo(w * 0.5 + i * 195, h);
        ctx.stroke();
      }
      ctx.restore();

      const centerX = w * 0.5;
      if (is3DMode) {
        drawHolodeck3DMatrix(centerX, bayCenterY - (isPortrait ? 22 : 12), w, isPortrait, currentMapId);
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, Math.max(82, bayCenterY - soldierRadius * 2.3));
        ctx.lineTo(centerX, padY + 14);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(centerX, bayCenterY, isShortLandscape ? 16 : 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '900 italic 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.52)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VS', centerX, bayCenterY + 0.5);
        ctx.restore();
      }

      const padW = isPortrait
        ? Math.min(82, w * 0.21)
        : isShortLandscape
          ? Math.min(100, w * 0.14)
          : Math.min(136, Math.max(96, w * 0.11));
      const padH = isShortLandscape || isPortrait ? 15 : 22;
      drawPedestal(blueBayX, padY, padW, padH, '0, 240, 255', '#38bdf8');
      drawPedestal(redBayX, padY, padW, padH, '255, 0, 85', '#fb7185');

      if (Math.random() < 0.22) {
        sparksRef.current.push({
          x: blueBayX + (Math.random() - 0.5) * padW * 0.9,
          y: padY - 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -22 - Math.random() * 35,
          life: 0.65 + Math.random() * 0.5,
          size: 1.4 + Math.random() * 1.6,
          color: '#38bdf8',
        });
      }
      if (Math.random() < 0.22) {
        sparksRef.current.push({
          x: redBayX + (Math.random() - 0.5) * padW * 0.9,
          y: padY - 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -22 - Math.random() * 35,
          life: 0.65 + Math.random() * 0.5,
          size: 1.4 + Math.random() * 1.6,
          color: '#fb7185',
        });
      }

      const renderFactionBay = (
        members: RosterMember[],
        bayCenterX: number,
        team: Team,
        defaultAim: number,
        teamTagColor: string,
      ) => {
        if (members.length === 0) {
          ctx.save();
          ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = team === 'blue' ? 'rgba(56, 189, 248, 0.48)' : 'rgba(251, 113, 133, 0.48)';
          ctx.textAlign = 'center';
          ctx.fillText('[ BAY STANDBY ]', bayCenterX, bayCenterY + 4);
          ctx.restore();
          return;
        }

        const maxSpan = isPortrait ? padW * 1.35 : padW * 1.65;
        const step = members.length > 1 ? Math.min(58, maxSpan / (members.length - 1)) : 0;
        const startX = bayCenterX - ((members.length - 1) * step) / 2;

        members.forEach((member, idx) => {
          const isLocal = member.playerId === myId;
          const px = startX + idx * step;
          const bobPhase = idx * 1.3;
          const hoverY = Math.sin(timeSec * 2.4 + bobPhase) * (member.isReady ? 4 : 2);
          const py = bayCenterY + hoverY + (members.length > 1 && idx % 2 === 1 ? 5 : 0);
          const slotRadius = members.length > 2 ? soldierRadius * 0.86 : soldierRadius;

          let aimAngle = defaultAim + Math.sin(timeSec * 0.75 + bobPhase) * 0.22;
          if (isLocal) {
            localBayPosRef.current = { x: px, y: py, team };
            const ptr = pointerRef.current;
            const desiredAim = ptr.active
              ? Math.atan2(ptr.y - py, ptr.x - px)
              : defaultAim + Math.sin(timeSec * 0.8) * 0.28;
            let delta = desiredAim - smoothLocalAim;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            smoothLocalAim += delta * Math.min(1, dt * 10);
            aimAngle = smoothLocalAim;
          }

          ctx.save();
          ctx.translate(px, py);
          renderAvatar(ctx, member.avatar || DEFAULT_AVATAR, {
            aimAngle,
            radius: slotRadius,
            isBoosting: member.isReady,
            team,
            showHUD: false,
            vx: 0,
            vy: Math.cos(timeSec * 2.4 + bobPhase) * 0.5,
            isGrounded: false,
            timeSec,
            weaponType: isLocal ? myWeapon : 'rifle',
          });
          ctx.restore();

          drawPilotTag(px, py, slotRadius, member, isLocal, teamTagColor);
        });
      };

      if (myTeam === 'blue') {
        renderFactionBay(reds, redBayX, 'red', Math.PI, '#fb7185');
        renderFactionBay(blues, blueBayX, 'blue', 0, '#38bdf8');
      } else {
        renderFactionBay(blues, blueBayX, 'blue', 0, '#38bdf8');
        renderFactionBay(reds, redBayX, 'red', Math.PI, '#fb7185');
      }

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

  const fireBayTestShot = (clientX: number, clientY: number) => {
    const pos = localBayPosRef.current;
    const angle = Math.atan2(clientY - pos.y, clientX - pos.x);
    pointerRef.current = { x: clientX, y: clientY, active: true };
    const wCfg = WEAPONS[defaultWeapon];
    sounds.playWeaponSound(defaultWeapon);

    const tracerColor = pos.team === 'blue' ? '#38bdf8' : '#fb7185';
    const count = wCfg.pellets;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.08 : 0;
      const a = angle + spread;
      const spd = 950;
      tracersRef.current.push({
        x: pos.x + Math.cos(a) * 28,
        y: pos.y + Math.sin(a) * 28,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.75,
        color: wCfg.color || tracerColor,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      sparksRef.current.push({
        x: pos.x + Math.cos(angle) * 30,
        y: pos.y + Math.sin(angle) * 30,
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
        fireBayTestShot(e.clientX, e.clientY);
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
      title="Move or drag to aim • Tap drop bay to test-fire weapon"
    />
  );
}
