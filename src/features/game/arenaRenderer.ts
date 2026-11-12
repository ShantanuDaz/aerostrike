import type { MutableRefObject } from 'react';
import type { GameMap } from '../map/types';
import { renderMap, renderRefillStations } from '../map/renderMap';
import { renderMinimap, type MinimapPlayerBlip } from '../map/renderMinimap';
import { renderPlayer, renderRagdoll, type Player, type RagdollInstance } from '../player';
import type { Camera } from '../camera';
import { renderBullets, renderParticles, renderWeaponPickups, useCombatStore } from '../combat';
import { renderFlags, useCTFStore } from '../ctf';
import { engineWorld } from './engineWorld';

export interface ParallaxStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkleOffset: number;
}

export interface ArenaRenderScratch {
  stars: ParallaxStar[];
  hazeCanvas: HTMLCanvasElement | null;
  hazeWidth: number;
  hazeHeight: number;
  remoteRenderScratch: Player;
  minimapPlayersBuf: MinimapPlayerBlip[];
}

export function createArenaRenderScratch(defaultAvatar: Player['avatar']): ArenaRenderScratch {
  return {
    stars: Array.from({ length: 72 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.4,
      alpha: 0.2 + Math.random() * 0.55,
      twinkleOffset: Math.random() * Math.PI * 2,
    })),
    hazeCanvas: null,
    hazeWidth: 0,
    hazeHeight: 0,
    remoteRenderScratch: {
      id: '',
      team: 'blue',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 16,
      boostFuel: 100,
      maxFuel: 100,
      health: 100,
      maxHealth: 100,
      aimAngle: 0,
      color: '#3b82f6',
      avatar: defaultAvatar,
      isDead: false,
      respawnTimer: 0,
      invulnerableTimer: 0,
      carryingFlag: false,
      isGrounded: true,
    },
    minimapPlayersBuf: [],
  };
}

export function syncAndRenderMinimap(
  map: GameMap,
  currentCamera: Camera,
  localPlayer: Player,
  dpr: number,
  isMultiplayer: boolean,
  minimapPlayersBuf: MinimapPlayerBlip[],
) {
  const mm = engineWorld.minimapTarget;
  if (mm.hidden || !mm.canvas) return;
  const mmCtx = mm.canvas.getContext('2d');
  if (!mmCtx) return;

  const mmTargetW = Math.floor(mm.width * dpr);
  const mmTargetH = Math.floor(mm.height * dpr);
  if (mm.canvas.width !== mmTargetW || mm.canvas.height !== mmTargetH) {
    mm.canvas.width = mmTargetW;
    mm.canvas.height = mmTargetH;
  }
  mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  minimapPlayersBuf.length = 0;
  minimapPlayersBuf.push({
    x: localPlayer.x,
    y: localPlayer.y,
    team: localPlayer.team,
    isLocal: true,
    hasFlag: localPlayer.carryingFlag,
  });

  for (const rp of engineWorld.remotePlayers.values()) {
    if (rp.isDead) continue;
    minimapPlayersBuf.push({
      x: rp.renderX,
      y: rp.renderY,
      team: rp.team,
      isLocal: false,
      hasFlag: rp.carryingFlag,
    });
  }

  if (!isMultiplayer) {
    for (let i = 0; i < engineWorld.soloBots.length; i++) {
      const bot = engineWorld.soloBots[i];
      if (bot.player.isDead) continue;
      minimapPlayersBuf.push({
        x: bot.player.x,
        y: bot.player.y,
        team: bot.team,
        isLocal: false,
        hasFlag: bot.player.carryingFlag,
      });
    }
  }

  const latestFlags = useCTFStore.getState().flags;
  renderMinimap(
    mmCtx,
    mm.width,
    mm.height,
    map,
    currentCamera,
    minimapPlayersBuf,
    [
      { x: latestFlags.blue.x, y: latestFlags.blue.y, team: 'blue' },
      { x: latestFlags.red.x, y: latestFlags.red.y, team: 'red' },
    ],
    engineWorld.stations,
  );
}

export interface RenderArenaFrameParams {
  ctx: CanvasRenderingContext2D;
  map: GameMap;
  viewW: number;
  viewH: number;
  dpr: number;
  dt: number;
  timeSec: number;
  currentCamera: Camera;
  localPlayer: Player;
  myPlayerId: string;
  isBoostingNow: boolean;
  isMultiplayer: boolean;
  ragdolls: RagdollInstance[];
  scratch: ArenaRenderScratch;
  screenShakeRef: MutableRefObject<number>;
  crosshairSpreadRef: MutableRefObject<number>;
  pointerPosRef: MutableRefObject<{ x: number; y: number; active: boolean }>;
  isTouchHUD: boolean;
}

export function renderArenaFrame(params: RenderArenaFrameParams) {
  const {
    ctx,
    map,
    viewW,
    viewH,
    dpr,
    dt,
    timeSec,
    currentCamera,
    localPlayer,
    myPlayerId,
    isBoostingNow,
    isMultiplayer,
    ragdolls,
    scratch,
    screenShakeRef,
    crosshairSpreadRef,
    pointerPosRef,
    isTouchHUD,
  } = params;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = map.backgroundColor || '#060913';
  ctx.fillRect(0, 0, viewW, viewH);

  const parX = currentCamera.x * 0.14;
  const parY = currentCamera.y * 0.14;
  if (scratch.hazeWidth !== viewW || scratch.hazeHeight !== viewH || !scratch.hazeCanvas) {
    scratch.hazeWidth = viewW;
    scratch.hazeHeight = viewH;
    scratch.hazeCanvas = document.createElement('canvas');
    scratch.hazeCanvas.width = Math.max(1, viewW);
    scratch.hazeCanvas.height = Math.max(1, viewH);
    const hCtx = scratch.hazeCanvas.getContext('2d');
    if (hCtx) {
      const blueHaze = hCtx.createRadialGradient(
        viewW * 0.25,
        viewH * 0.35,
        20,
        viewW * 0.25,
        viewH * 0.35,
        Math.max(viewW, viewH) * 0.6,
      );
      blueHaze.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
      blueHaze.addColorStop(1, 'rgba(6, 9, 19, 0)');
      hCtx.fillStyle = blueHaze;
      hCtx.fillRect(0, 0, viewW, viewH);

      const redHaze = hCtx.createRadialGradient(
        viewW * 0.78,
        viewH * 0.45,
        20,
        viewW * 0.78,
        viewH * 0.45,
        Math.max(viewW, viewH) * 0.55,
      );
      redHaze.addColorStop(0, 'rgba(255, 0, 85, 0.065)');
      redHaze.addColorStop(1, 'rgba(6, 9, 19, 0)');
      hCtx.fillStyle = redHaze;
      hCtx.fillRect(0, 0, viewW, viewH);
    }
  }
  ctx.drawImage(scratch.hazeCanvas, 0, 0, viewW, viewH);

  for (const star of scratch.stars) {
    const sx = (((star.x * viewW - parX * 0.45) % viewW) + viewW) % viewW;
    const sy =
      (((star.y * viewH * 0.82 - parY * 0.35) % (viewH * 0.85)) + viewH * 0.85) %
      (viewH * 0.85);
    const tw = 0.65 + Math.sin(timeSec * 2.1 + star.twinkleOffset) * 0.35;
    ctx.fillStyle = `rgba(186, 230, 253, ${star.alpha * tw})`;
    ctx.beginPath();
    ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  let shakeX = 0;
  let shakeY = 0;
  if (screenShakeRef.current > 0.05) {
    shakeX = (Math.random() - 0.5) * screenShakeRef.current;
    shakeY = (Math.random() - 0.5) * screenShakeRef.current;
    screenShakeRef.current *= Math.pow(0.88, dt * 60);
  }
  ctx.save();
  ctx.translate(-currentCamera.x + shakeX, -currentCamera.y + shakeY);

  renderMap(ctx, map, timeSec, true);
  renderRefillStations(ctx, engineWorld.stations, timeSec);
  renderWeaponPickups(ctx, engineWorld.pickups, timeSec);
  renderFlags(ctx, Object.values(useCTFStore.getState().flags), timeSec);

  for (const ragdoll of ragdolls) {
    renderRagdoll(ctx, ragdoll, timeSec);
  }

  renderBullets(ctx, engineWorld.bullets);
  renderParticles(ctx, engineWorld.particles);

  const rScratch = scratch.remoteRenderScratch;
  for (const rp of engineWorld.remotePlayers.values()) {
    rScratch.id = rp.id;
    rScratch.team = rp.team;
    rScratch.x = rp.renderX;
    rScratch.y = rp.renderY;
    rScratch.vx = rp.vx;
    rScratch.vy = rp.vy;
    rScratch.health = rp.health;
    rScratch.aimAngle = rp.renderAimAngle;
    rScratch.color = rp.team === 'blue' ? '#3b82f6' : '#ef4444';
    rScratch.avatar = rp.avatar;
    rScratch.isDead = rp.isDead;
    rScratch.invulnerableTimer = rp.isInvulnerable ? 1 : 0;
    rScratch.carryingFlag = rp.carryingFlag;
    rScratch.isGrounded = rp.isGrounded;
    renderPlayer(ctx, rScratch, timeSec, rp.isBoosting, rp.weaponType);
  }

  if (!isMultiplayer) {
    for (let i = 0; i < engineWorld.soloBots.length; i++) {
      const bot = engineWorld.soloBots[i];
      renderPlayer(ctx, bot.player, timeSec, bot.isBoostingNow, bot.weaponType, false);
    }
  }

  renderPlayer(
    ctx,
    localPlayer,
    timeSec,
    isBoostingNow,
    useCombatStore.getState().equippedWeapon,
    true,
  );

  if (engineWorld.floatingTexts.length > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < engineWorld.floatingTexts.length; i++) {
      const ft = engineWorld.floatingTexts[i];
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      const fontSize = Math.round(13 * ft.scale);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.strokeStyle = 'rgba(6, 9, 19, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  ctx.restore();

  if (engineWorld.damageIndicators.length > 0) {
    const cx = viewW / 2;
    const cy = viewH / 2;
    const arcDist = Math.min(viewW, viewH) * 0.32;
    for (let i = 0; i < engineWorld.damageIndicators.length; i++) {
      const ind = engineWorld.damageIndicators[i];
      const fade = Math.max(0, ind.life / ind.maxLife);
      const alpha = fade * ind.intensity * 0.72;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ind.angle);
      ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
      ctx.lineWidth = 8 * ind.intensity;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, arcDist, -0.34, 0.34);
      ctx.stroke();

      ctx.fillStyle = `rgba(251, 113, 133, ${Math.min(0.9, alpha * 1.2)})`;
      ctx.beginPath();
      ctx.moveTo(arcDist + 14, 0);
      ctx.lineTo(arcDist + 2, -7);
      ctx.lineTo(arcDist + 2, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const currentFlags = useCTFStore.getState().flags;
  const enemyTeam = localPlayer.team === 'blue' ? 'red' : 'blue';
  const enemyFlag = currentFlags[enemyTeam];
  let targetWorldX = enemyFlag.x;
  let targetWorldY = enemyFlag.y;
  if (enemyFlag.status === 'carried' && enemyFlag.carrierId) {
    const carrierRemote = engineWorld.remotePlayers.get(enemyFlag.carrierId);
    const carrierBot = !isMultiplayer ? engineWorld.getSoloBot(enemyFlag.carrierId) : undefined;
    if (carrierRemote) {
      targetWorldX = carrierRemote.renderX;
      targetWorldY = carrierRemote.renderY;
    } else if (carrierBot) {
      targetWorldX = carrierBot.player.x;
      targetWorldY = carrierBot.player.y;
    } else if (
      enemyFlag.carrierId === localPlayer.id ||
      enemyFlag.carrierId === myPlayerId
    ) {
      targetWorldX = currentFlags[localPlayer.team].baseX;
      targetWorldY = currentFlags[localPlayer.team].baseY;
    }
  }

  const scrX = targetWorldX - currentCamera.x;
  const scrY = targetWorldY - currentCamera.y;
  const marginX = 28;
  const marginTop = 64;
  const marginBot = 46;
  if (scrX < 0 || scrX > viewW || scrY < 0 || scrY > viewH) {
    const clampedX = Math.max(marginX, Math.min(viewW - marginX, scrX));
    const clampedY = Math.max(marginTop, Math.min(viewH - marginBot, scrY));
    const ang = Math.atan2(scrY - viewH / 2, scrX - viewW / 2);
    const indicatorColor = localPlayer.carryingFlag
      ? '#34d399'
      : enemyTeam === 'red'
        ? '#fb7185'
        : '#38bdf8';

    ctx.save();
    ctx.translate(clampedX, clampedY);
    ctx.rotate(ang);
    ctx.fillStyle = indicatorColor;
    ctx.strokeStyle = '#060913';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  crosshairSpreadRef.current = Math.max(0, crosshairSpreadRef.current - dt * 36);
  if (!isTouchHUD && pointerPosRef.current.active) {
    const mx = pointerPosRef.current.x;
    const my = pointerPosRef.current.y;
    const gap = 5 + crosshairSpreadRef.current;
    const tickLen = 6;
    const accent = localPlayer.team === 'blue' ? '#38bdf8' : '#fb7185';

    ctx.save();
    ctx.translate(mx, my);
    ctx.strokeStyle = 'rgba(6, 9, 19, 0.75)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-gap - tickLen, 0);
    ctx.lineTo(-gap, 0);
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + tickLen, 0);
    ctx.moveTo(0, -gap - tickLen);
    ctx.lineTo(0, -gap);
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + tickLen);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
