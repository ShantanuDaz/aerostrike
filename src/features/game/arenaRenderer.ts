import type { MutableRefObject } from 'react';
import type { GameMap } from '../map/types';
import { renderMap, renderRefillStations } from '../map/renderMap';
import { renderMinimap, type MinimapPlayerBlip } from '../map/renderMinimap';
import { raycastMapTerrain } from '../map/terrainGeometry';
import {
  createBackdropCache,
  renderBackdropWorldProps,
  renderProceduralBackdrop,
  resolveMapTheme,
  type BackdropCache,
} from '../map/renderBackdrop';
import { renderPlayer, renderRagdoll, type Player, type RagdollInstance } from '../player';
import { worldToScreen, type Camera } from '../camera';
import { renderBullets, renderParticles, renderWeaponPickups, useCombatStore } from '../combat';
import { WEAPONS } from '../combat/weaponsConfig';
import { renderFlags, useCTFStore } from '../ctf';
import { useSettingsStore } from '../settings/settingsStore';
import { engineWorld } from './engineWorld';

export interface ArenaRenderScratch {
  backdropCache: BackdropCache | null;
  remoteRenderScratch: Player;
  minimapPlayersBuf: MinimapPlayerBlip[];
}

export function createArenaRenderScratch(defaultAvatar: Player['avatar']): ArenaRenderScratch {
  return {
    backdropCache: null,
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
  const highContrast = useSettingsStore.getState().highContrastTeamMarkers;
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
    highContrast,
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

function drawOffscreenFlagIndicator(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  camera: Camera,
  viewW: number,
  viewH: number,
  color: string,
  label: string | null,
) {
  const { screenX: scrX, screenY: scrY } = worldToScreen(worldX, worldY, camera);
  if (scrX >= 0 && scrX <= viewW && scrY >= 0 && scrY <= viewH) {
    return;
  }

  const marginX = 28;
  const marginTop = 64;
  const marginBot = 46;
  const clampedX = Math.max(marginX, Math.min(viewW - marginX, scrX));
  const clampedY = Math.max(marginTop, Math.min(viewH - marginBot, scrY));
  const ang = Math.atan2(scrY - viewH / 2, scrX - viewW / 2);

  ctx.save();
  ctx.translate(clampedX, clampedY);

  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = color;
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

  if (label) {
    ctx.font = 'bold 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textOffsetY = clampedY < viewH * 0.22 ? 15 : -14;
    ctx.strokeStyle = 'rgba(6, 9, 19, 0.92)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, 0, textOffsetY);
    ctx.fillStyle = color;
    ctx.fillText(label, 0, textOffsetY);
  }

  ctx.restore();
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

  const settings = useSettingsStore.getState();
  const zoom = currentCamera.zoom > 0 ? currentCamera.zoom : 1;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const themeId = resolveMapTheme(map);
  const backdropKey = `${map.id}:${themeId}:${viewW}x${viewH}`;
  if (!scratch.backdropCache || scratch.backdropCache.key !== backdropKey) {
    scratch.backdropCache = createBackdropCache(map, viewW, viewH);
  }
  renderProceduralBackdrop(
    ctx,
    scratch.backdropCache,
    map,
    currentCamera,
    viewW,
    viewH,
    timeSec,
  );

  let shakeX = 0;
  let shakeY = 0;
  if (screenShakeRef.current > 0.05) {
    shakeX = (Math.random() - 0.5) * screenShakeRef.current;
    shakeY = (Math.random() - 0.5) * screenShakeRef.current;
    screenShakeRef.current *= Math.pow(0.88, dt * 60);
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-currentCamera.x, -currentCamera.y);

  renderBackdropWorldProps(ctx, map, timeSec);
  renderMap(ctx, map, timeSec, true);
  renderRefillStations(ctx, engineWorld.stations, timeSec);
  renderWeaponPickups(ctx, engineWorld.pickups, timeSec);
  renderFlags(ctx, Object.values(useCTFStore.getState().flags), timeSec);

  for (const ragdoll of ragdolls) {
    renderRagdoll(ctx, ragdoll, timeSec);
  }

  renderBullets(ctx, engineWorld.bullets);
  renderParticles(ctx, engineWorld.particles);

  // Subtle touch aim laser sightline clamped at walls/slopes/curves for mobile precision
  if (isTouchHUD && settings.touchAimLine && !localPlayer.isDead) {
    const originX = localPlayer.x;
    const originY = localPlayer.y - 5;
    const maxLen = 280;
    const cosA = Math.cos(localPlayer.aimAngle);
    const sinA = Math.sin(localPlayer.aimAngle);
    const endX = originX + cosA * maxLen;
    const endY = originY + sinA * maxLen;
    const terrainHit = raycastMapTerrain(originX, originY, endX, endY, map);
    const minT = terrainHit ? terrainHit.t : 1;
    if (minT > 18 / maxLen) {
      const startX = originX + cosA * 18;
      const startY = originY + sinA * 18;
      const hitX = originX + (endX - originX) * minT;
      const hitY = originY + (endY - originY) * minT;
      const teamRgb = localPlayer.team === 'blue' ? '56, 189, 248' : '251, 113, 133';
      const laserGrad = ctx.createLinearGradient(startX, startY, hitX, hitY);
      laserGrad.addColorStop(0, `rgba(${teamRgb}, 0.52)`);
      laserGrad.addColorStop(1, `rgba(${teamRgb}, 0.06)`);

      ctx.save();
      ctx.strokeStyle = laserGrad;
      ctx.lineWidth = Math.max(1.2, 1.6 / zoom);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(hitX, hitY);
      ctx.stroke();

      if (minT < 0.99) {
        ctx.fillStyle = `rgba(${teamRgb}, 0.72)`;
        ctx.beginPath();
        ctx.arc(hitX, hitY, 2.4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

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
    renderPlayer(
      ctx,
      rScratch,
      timeSec,
      rp.isBoosting,
      rp.weaponType,
      false,
      zoom,
      settings.highContrastTeamMarkers,
    );
  }

  if (!isMultiplayer) {
    for (let i = 0; i < engineWorld.soloBots.length; i++) {
      const bot = engineWorld.soloBots[i];
      renderPlayer(
        ctx,
        bot.player,
        timeSec,
        bot.isBoostingNow,
        bot.weaponType,
        false,
        zoom,
        settings.highContrastTeamMarkers,
      );
    }
  }

  renderPlayer(
    ctx,
    localPlayer,
    timeSec,
    isBoostingNow,
    useCombatStore.getState().equippedWeapon,
    true,
    zoom,
    settings.highContrastTeamMarkers,
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
  const friendlyTeam = localPlayer.team;
  const enemyTeam = friendlyTeam === 'blue' ? 'red' : 'blue';
  const enemyFlag = currentFlags[enemyTeam];
  const friendlyFlag = currentFlags[friendlyTeam];

  const resolveFlagWorldPos = (flag: typeof enemyFlag) => {
    let wx = flag.x;
    let wy = flag.y;
    if (flag.status === 'carried' && flag.carrierId) {
      const carrierRemote = engineWorld.remotePlayers.get(flag.carrierId);
      const carrierBot = !isMultiplayer ? engineWorld.getSoloBot(flag.carrierId) : undefined;
      if (carrierRemote) {
        wx = carrierRemote.renderX;
        wy = carrierRemote.renderY;
      } else if (carrierBot) {
        wx = carrierBot.player.x;
        wy = carrierBot.player.y;
      } else if (flag.carrierId === localPlayer.id || flag.carrierId === myPlayerId) {
        wx = friendlyFlag.baseX;
        wy = friendlyFlag.baseY;
      }
    }
    return { wx, wy };
  };

  // Primary objective indicator (enemy flag, or home base when carrying)
  const primaryPos = localPlayer.carryingFlag
    ? { wx: friendlyFlag.baseX, wy: friendlyFlag.baseY }
    : resolveFlagWorldPos(enemyFlag);
  const primaryColor = localPlayer.carryingFlag
    ? '#34d399'
    : enemyTeam === 'red'
      ? '#fb7185'
      : '#38bdf8';
  const primaryLabel = localPlayer.carryingFlag
    ? 'HOME'
    : enemyFlag.status === 'dropped'
      ? `${Math.max(1, Math.ceil(enemyFlag.returnTimer))}s`
      : 'FLAG';
  drawOffscreenFlagIndicator(
    ctx,
    primaryPos.wx,
    primaryPos.wy,
    currentCamera,
    viewW,
    viewH,
    primaryColor,
    primaryLabel,
  );

  // Secondary alert indicator when our friendly flag is away from base
  if (friendlyFlag.status !== 'at_base') {
    const friendlyPos = resolveFlagWorldPos(friendlyFlag);
    const secLabel =
      friendlyFlag.status === 'dropped'
        ? `RET ${Math.max(1, Math.ceil(friendlyFlag.returnTimer))}s`
        : 'DEFEND';
    drawOffscreenFlagIndicator(
      ctx,
      friendlyPos.wx,
      friendlyPos.wy,
      currentCamera,
      viewW,
      viewH,
      '#fbbf24',
      secLabel,
    );
  }

  crosshairSpreadRef.current = Math.max(0, crosshairSpreadRef.current - dt * 36);
  if (!isTouchHUD && pointerPosRef.current.active) {
    const mx = pointerPosRef.current.x;
    const my = pointerPosRef.current.y;
    const gap = 5 + crosshairSpreadRef.current;
    const tickLen = 6;
    const combatState = useCombatStore.getState();
    const activeCfg = WEAPONS[combatState.equippedWeapon];
    const isLowAmmo =
      activeCfg.maxAmmo !== Infinity &&
      combatState.currentAmmo <= Math.max(1, Math.ceil(activeCfg.maxAmmo * 0.25));
    const accent = isLowAmmo
      ? '#fbbf24'
      : localPlayer.team === 'blue'
        ? '#38bdf8'
        : '#fb7185';

    const elapsedSinceShot = performance.now() - combatState.lastFiredAt;
    const reloadProgress =
      activeCfg.fireRateMs > 0 ? Math.min(1, elapsedSinceShot / activeCfg.fireRateMs) : 1;

    ctx.save();
    ctx.translate(mx, my);

    if (reloadProgress < 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, gap + tickLen + 4, -Math.PI / 2, -Math.PI / 2 + reloadProgress * Math.PI * 2);
      ctx.stroke();
    } else if (isLowAmmo) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, gap + tickLen + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

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
