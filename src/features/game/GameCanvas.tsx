import { useEffect, useRef, useCallback } from 'react';
import type { GameMap } from '../map/types';
import { renderMap, renderRefillStations } from '../map/renderMap';
import { renderMinimap, type MinimapPlayerBlip } from '../map/renderMinimap';
import {
  renderPlayer,
  updatePlayer,
  usePlayerStore,
  createRagdoll,
  updateRagdolls,
  renderRagdoll,
  type Player,
  type RagdollInstance,
} from '../player';
import { createCamera, updateCamera, screenToWorld, type Camera } from '../camera';
import {
  renderBullets,
  renderParticles,
  renderWeaponPickups,
  updateBullets,
  updateParticles,
  createSparks,
  useCombatStore,
  useMatchStatsStore,
  type ActiveWeaponPickup,
  type TargetPlayer,
  type WeaponType,
} from '../combat';
import { renderFlags, useCTFStore } from '../ctf';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { useAvatarStore } from '../avatar/avatarStore';
import { MinimapView } from '../ui/MinimapView';
import { VirtualControls } from '../controls/VirtualControls';
import { useIsTouchHUD } from '../controls/useIsTouchHUD';
import { sounds } from '../audio/soundEngine';
import { useSettingsStore } from '../settings/settingsStore';
import { buildActiveStations, engineWorld } from './engineWorld';
import { stepSoloBots } from './botAI';

interface ParallaxStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkleOffset: number;
}

interface GameCanvasProps {
  map: GameMap;
}

const WEAPON_KEYS: Record<string, WeaponType> = {
  Digit1: 'rifle',
  Digit2: 'shotgun',
  Digit3: 'sniper',
  Digit4: 'rocket',
  Digit5: 'pistol',
};

export function GameCanvas({ map }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenShakeRef = useRef(0);
  const crosshairSpreadRef = useRef(0);
  const pointerPosRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const ragdollsRef = useRef<RagdollInstance[]>([]);
  const prevDeadMapRef = useRef<Map<string, boolean>>(new Map());
  const prevLocalDeadRef = useRef(false);

  const isTouchHUD = useIsTouchHUD();
  const isTouchHUDRef = useRef(isTouchHUD);
  useEffect(() => {
    isTouchHUDRef.current = isTouchHUD;
  }, [isTouchHUD]);

  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
  const viewportRef = useRef({
    width: initialWidth,
    height: initialHeight,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  });
  const cameraRef = useRef<Camera>(createCamera(initialWidth, initialHeight));

  // Direct HiDPI canvas sizing on resize (zero React re-renders)
  useEffect(() => {
    const syncCanvasSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewportRef.current = { width, height, dpr };

      const canvas = canvasRef.current;
      if (canvas) {
        const targetW = Math.floor(width * dpr);
        const targetH = Math.floor(height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }

      cameraRef.current = {
        ...cameraRef.current,
        viewportWidth: width,
        viewportHeight: height,
      };
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    window.addEventListener('orientationchange', syncCanvasSize);
    return () => {
      window.removeEventListener('resize', syncCanvasSize);
      window.removeEventListener('orientationchange', syncCanvasSize);
    };
  }, []);

  // Initialize match world pickups, refill stations, spawn, and snap camera when map changes
  useEffect(() => {
    const initialPickups: ActiveWeaponPickup[] = (map.weaponSpawns || []).map((ws) => ({
      id: ws.id,
      x: ws.x,
      y: ws.y,
      weaponType: ws.weaponType,
      respawnTimer: 0,
    }));
    engineWorld.resetWorldForMatch(initialPickups, false, buildActiveStations(map));

    const netState = useNetworkStore.getState();
    const isMultiplayer = Boolean(netState.roomCode);
    const ctf = useCTFStore.getState();
    if (!isMultiplayer && ctf.stateSeq === 0) {
      ctf.initMatch(map);
    } else if (
      isMultiplayer &&
      ctf.flags.blue.baseX !== map.flagBlue.x &&
      netState.isHost
    ) {
      ctf.initMatch(map);
    }

    const myPlayerId = useAvatarStore.getState().playerId;
    usePlayerStore.getState().spawnAtTeamBase(map, myPlayerId);
    const spawnedLocal = usePlayerStore.getState().player;

    const stats = useMatchStatsStore.getState();
    stats.registerParticipant(myPlayerId, spawnedLocal.avatar.callsign, spawnedLocal.team);
    if (!isMultiplayer) {
      engineWorld.spawnSoloBots(map, spawnedLocal.team);
      for (const bot of engineWorld.soloBots) {
        stats.registerParticipant(bot.id, bot.player.avatar.callsign, bot.team);
      }
    } else {
      engineWorld.clearSoloBots();
      for (const member of Object.values(netState.roster)) {
        stats.registerParticipant(member.playerId, member.callsign, member.team);
      }
    }

    ragdollsRef.current = [];
    prevDeadMapRef.current.clear();
    prevLocalDeadRef.current = false;

    const p = spawnedLocal;
    const w = window.innerWidth;
    const h = window.innerHeight;
    cameraRef.current = updateCamera(
      createCamera(w, h),
      p.x,
      p.y,
      map.width,
      map.height,
      1.0,
    );
  }, [map]);

  // Sync avatar edits without clobbering live velocity/position
  const avatar = useAvatarStore((s) => s.avatar);
  useEffect(() => {
    const live = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    usePlayerStore.getState().setPlayer({ ...live, avatar });
  }, [avatar]);

  // Weapon Fire Handler (reads live engineWorld position + applies recoil cleanly)
  const handleFire = useCallback(() => {
    const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    if (player.isDead) return;

    const muzzleOriginX = player.x;
    const muzzleOriginY = player.y - 5;

    const fireResult = useCombatStore.getState().fireWeapon({
      shooterId: player.id,
      team: player.team,
      originX: muzzleOriginX,
      originY: muzzleOriginY,
      aimAngle: player.aimAngle,
      map,
    });

    if (fireResult) {
      crosshairSpreadRef.current = Math.min(
        12,
        crosshairSpreadRef.current + Math.max(3, fireResult.recoil * 1.4),
      );
      if (useSettingsStore.getState().screenShake) {
        screenShakeRef.current = Math.min(7, fireResult.recoil * 0.85);
      }

      const recoilImpulse = fireResult.recoil;
      player.vx -= Math.cos(player.aimAngle) * recoilImpulse;
      player.vy -= Math.sin(player.aimAngle) * recoilImpulse;

      networkManager.broadcastShoot({
        shooterId: player.id,
        team: player.team,
        weaponType: fireResult.firedWeapon,
        originX: muzzleOriginX,
        originY: muzzleOriginY,
        aimAngle: player.aimAngle,
      });
    }
  }, [map]);

  // Switch Weapon Handler
  const handleSwitchWeapon = useCallback(() => {
    useCombatStore.getState().cycleWeapon();
  }, []);

  // Main 60/120 FPS Zero-React-Commit Engine & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let lastMinimapSync = 0;
    let lastHudSync = 0;
    let lastHudHealth = -1;
    let lastHudFuel = -1;
    let lastHudDead = false;
    let lastHudFlag = false;
    let lastHudDashTenths = -1;
    let lastHudOverheated = false;
    let lastPrevBoosting = false;
    let lastPrevGrounded = false;
    let lastFlagClaimMs = 0;
    let isMouseDown = false;

    const keys: Record<string, boolean> = {};
    const prevBotDashing = new Set<string>();
    const prevBotBouncing = new Set<string>();
    const targetPlayersBuf: TargetPlayer[] = [];
    const minimapPlayersBuf: MinimapPlayerBlip[] = [];
    let hazeCanvas: HTMLCanvasElement | null = null;
    let hazeWidth = 0;
    let hazeHeight = 0;
    const remoteRenderScratch: Player = {
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
      avatar: useAvatarStore.getState().avatar,
      isDead: false,
      respawnTimer: 0,
      invulnerableTimer: 0,
      carryingFlag: false,
      isGrounded: true,
    };

    const syncKeyboardInput = () => {
      let moveX = 0;
      if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
      const moveY = keys['KeyS'] || keys['ArrowDown'] ? 1 : 0;
      const boosting = Boolean(keys['KeyW'] || keys['ArrowUp'] || keys['Space']);
      const dash = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyE']);
      usePlayerStore.getState().setInput({ moveX, moveY, boosting, dash });
    };

    const clearAllInputs = () => {
      for (const code in keys) {
        keys[code] = false;
      }
      isMouseDown = false;
      usePlayerStore
        .getState()
        .setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
      sounds.setJetpackBoosting(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAllInputs();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      keys[e.code] = true;
      if (WEAPON_KEYS[e.code]) {
        useCombatStore.getState().setEquippedWeapon(WEAPON_KEYS[e.code]);
      }
      if (e.code === 'KeyQ' && !e.repeat) {
        handleSwitchWeapon();
      }
      syncKeyboardInput();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      syncKeyboardInput();
    };

    const stars: ParallaxStar[] = Array.from({ length: 72 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.4,
      alpha: 0.2 + Math.random() * 0.55,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      pointerPosRef.current = { x: screenX, y: screenY, active: true };

      const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
      const { worldX, worldY } = screenToWorld(screenX, screenY, cameraRef.current);

      const aimAngle = Math.atan2(worldY - (player.y - 5), worldX - player.x);
      usePlayerStore.getState().setInput({ aimAngle });
    };

    const handleMouseLeave = () => {
      pointerPosRef.current = { ...pointerPosRef.current, active: false };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown = true;
        handleFire();
      }
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const startPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    let currentCamera = updateCamera(
      createCamera(viewportRef.current.width, viewportRef.current.height),
      startPlayer.x,
      startPlayer.y,
      map.width,
      map.height,
      1.0,
    );
    cameraRef.current = currentCamera;

    const loop = (timestamp: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (timestamp - lastTime) / 1000));
      lastTime = timestamp;
      const timeSec = timestamp / 1000;

      const playerStore = usePlayerStore.getState();
      const ctfStore = useCTFStore.getState();
      const networkStore = useNetworkStore.getState();
      const myPlayerId = useAvatarStore.getState().playerId;
      const isMultiplayer = Boolean(networkStore.roomCode);
      const isAuthoritativeCTF = !isMultiplayer || networkStore.isHost;

      if (isMouseDown || playerStore.input.shooting) {
        handleFire();
      }

      // 1. UPDATE LOCAL PLAYER PHYSICS directly in engineWorld (Zero React commit)
      const currentLocal = engineWorld.localPlayer ?? playerStore.player;
      const wasLocalDead = prevLocalDeadRef.current;
      const wasLocalAliveBeforePhysics = !currentLocal.isDead;
      const wasLocalDashing = (currentLocal.dashActiveTimer ?? 0) > 0;
      const wasLocalBouncing = (currentLocal.bounceCooldownTimer ?? 0) > 0;
      const prevCarryingFlag = currentLocal.carryingFlag;
      const nextPlayer = updatePlayer(
        currentLocal,
        playerStore.input,
        map,
        dt,
        true,
        ctfStore.matchRules.respawnDelaySec,
      );
      engineWorld.localPlayer = nextPlayer;

      if (!wasLocalDashing && (nextPlayer.dashActiveTimer ?? 0) > 0) {
        const dashColor = nextPlayer.team === 'blue' ? '#38bdf8' : '#fb7185';
        engineWorld.addParticles(createSparks(nextPlayer.x, nextPlayer.y, 12, dashColor));
      }
      if (!wasLocalBouncing && (nextPlayer.bounceCooldownTimer ?? 0) > 0.14) {
        engineWorld.addParticles(createSparks(nextPlayer.x, nextPlayer.y + 18, 10, '#22d3ee'));
        networkManager.notifyLocalStateChanged();
      }

      // Reset loadout to default starting weapon upon respawn
      if (wasLocalDead && !nextPlayer.isDead) {
        useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
      }

      // Notify network immediately on discrete edge transitions (boost, ground, death, respawn, flag)
      const isBoostingNow =
        playerStore.input.boosting &&
        !nextPlayer.fuelOverheated &&
        nextPlayer.boostFuel > 0 &&
        !nextPlayer.isDead;
      const groundedNow = Boolean(nextPlayer.isGrounded);
      const discreteEdge =
        wasLocalDead !== nextPlayer.isDead ||
        prevCarryingFlag !== nextPlayer.carryingFlag ||
        lastPrevBoosting !== isBoostingNow ||
        lastPrevGrounded !== groundedNow;

      lastPrevBoosting = isBoostingNow;
      lastPrevGrounded = groundedNow;

      if (discreteEdge) {
        networkManager.notifyLocalStateChanged();
      }

      // Spawn Verlet Ragdoll when local player dies (bullet, rocket, or hazard)
      if (!wasLocalDead && nextPlayer.isDead) {
        ragdollsRef.current.push(
          createRagdoll({
            id: `rag_local_${timestamp}`,
            x: nextPlayer.x,
            y: nextPlayer.y,
            vx: nextPlayer.vx,
            vy: nextPlayer.vy,
            aimAngle: nextPlayer.aimAngle,
            team: nextPlayer.team,
            avatar: nextPlayer.avatar,
          }),
        );
        engineWorld.addParticles(createSparks(nextPlayer.x, nextPlayer.y, 14, '#ef4444'));

        if (wasLocalAliveBeforePhysics) {
          const hazardEvt = {
            id: `kill_${myPlayerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            killerId: 'hazard',
            killerCallsign: 'ARENA',
            killerTeam: (nextPlayer.team === 'blue' ? 'red' : 'blue') as 'blue' | 'red',
            victimId: myPlayerId,
            victimCallsign: nextPlayer.avatar.callsign,
            victimTeam: nextPlayer.team,
            weaponType: 'hazard' as const,
          };
          if (isMultiplayer) {
            networkManager.broadcastKillFeed(hazardEvt);
          } else {
            useMatchStatsStore.getState().recordKill(hazardEvt);
          }
        }

        if (prevCarryingFlag) {
          const enemyTeam = nextPlayer.team === 'blue' ? 'red' : 'blue';
          if (ctfStore.flags[enemyTeam].status === 'carried') {
            if (isAuthoritativeCTF) {
              ctfStore.dropFlag(enemyTeam, nextPlayer.x, nextPlayer.y);
            } else {
              networkManager.broadcastFlagEvent({
                action: 'drop',
                team: enemyTeam,
                carrierId: myPlayerId,
                x: nextPlayer.x,
                y: nextPlayer.y,
              });
            }
          }
        }
      }
      prevLocalDeadRef.current = nextPlayer.isDead;

      // 2. INTERPOLATE & DEAD-RECKON REMOTE PLAYERS (60/120 FPS silky motion)
      engineWorld.stepRemotePlayers(dt, timestamp, map);

      for (const rp of engineWorld.remotePlayers.values()) {
        const wasDead = prevDeadMapRef.current.get(rp.id) ?? false;
        if (!wasDead && rp.isDead) {
          ragdollsRef.current.push(
            createRagdoll({
              id: `rag_${rp.id}_${timestamp}`,
              x: rp.renderX,
              y: rp.renderY,
              vx: rp.vx,
              vy: rp.vy,
              aimAngle: rp.renderAimAngle,
              team: rp.team,
              avatar: rp.avatar,
            }),
          );
          engineWorld.addParticles(createSparks(rp.renderX, rp.renderY, 14, '#ef4444'));
        }
        prevDeadMapRef.current.set(rp.id, rp.isDead);
      }

      // 2b. SOLO SKIRMISH AI SQUAD UPDATE (2v2 local bots when offline)
      if (!isMultiplayer && engineWorld.soloBots.length > 0) {
        prevBotDashing.clear();
        prevBotBouncing.clear();
        for (let i = 0; i < engineWorld.soloBots.length; i++) {
          const b = engineWorld.soloBots[i];
          if ((b.player.dashActiveTimer ?? 0) > 0) {
            prevBotDashing.add(b.id);
          }
          if ((b.player.bounceCooldownTimer ?? 0) > 0) {
            prevBotBouncing.add(b.id);
          }
        }

        const botStep = stepSoloBots({
          bots: engineWorld.soloBots,
          localPlayer: nextPlayer,
          map,
          flags: ctfStore.flags,
          matchStatus: ctfStore.matchStatus,
          pickups: engineWorld.pickups,
          stations: engineWorld.stations,
          respawnDelaySec: ctfStore.matchRules.respawnDelaySec,
          nowMs: timestamp,
          dt,
        });

        if (botStep.spawnedBullets.length > 0) {
          engineWorld.addBullets(botStep.spawnedBullets);
        }

        for (let i = 0; i < engineWorld.soloBots.length; i++) {
          const b = engineWorld.soloBots[i];
          if ((b.player.dashActiveTimer ?? 0) > 0 && !prevBotDashing.has(b.id)) {
            const dashColor = b.team === 'blue' ? '#38bdf8' : '#fb7185';
            engineWorld.addParticles(createSparks(b.player.x, b.player.y, 10, dashColor));
          }
          if ((b.player.bounceCooldownTimer ?? 0) > 0.14 && !prevBotBouncing.has(b.id)) {
            engineWorld.addParticles(createSparks(b.player.x, b.player.y + 18, 9, '#22d3ee'));
          }
        }

        for (let i = 0; i < botStep.stationEffects.length; i++) {
          const fx = botStep.stationEffects[i];
          engineWorld.addParticles(createSparks(fx.x, fx.y, 10, fx.color));
        }

        for (let i = 0; i < botStep.newlyDeadBots.length; i++) {
          const deadEntry = botStep.newlyDeadBots[i];
          const b = deadEntry.bot;
          ragdollsRef.current.push(
            createRagdoll({
              id: `rag_${b.id}_${timestamp}`,
              x: b.player.x,
              y: b.player.y,
              vx: b.player.vx,
              vy: b.player.vy,
              aimAngle: b.player.aimAngle,
              team: b.team,
              avatar: b.player.avatar,
            }),
          );
          engineWorld.addParticles(createSparks(b.player.x, b.player.y, 14, '#ef4444'));
          if (deadEntry.droppedFlagTeam) {
            ctfStore.dropFlag(deadEntry.droppedFlagTeam, b.player.x, b.player.y);
          }
          useMatchStatsStore.getState().recordKill({
            id: `kill_${b.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            killerId: 'hazard',
            killerCallsign: 'ARENA',
            killerTeam: b.team === 'blue' ? 'red' : 'blue',
            victimId: b.id,
            victimCallsign: b.player.avatar.callsign,
            victimTeam: b.team,
            weaponType: 'hazard',
          });
        }

        for (let i = 0; i < botStep.flagEvents.length; i++) {
          const ev = botStep.flagEvents[i];
          const actorBot = engineWorld.getSoloBot(ev.carrierId);
          if (ev.action === 'pickup') {
            if (ctfStore.pickupFlag(ev.team, ev.carrierId) && actorBot) {
              actorBot.player.carryingFlag = true;
            }
          } else if (ev.action === 'return') {
            ctfStore.returnFlag(ev.team);
          } else if (ev.action === 'capture') {
            if (ctfStore.captureFlag(ev.team, ev.carrierName, ev.carrierId) && actorBot) {
              actorBot.player.carryingFlag = false;
            }
          }
        }
      }

      // 3. UPDATE VERLET RAGDOLLS
      if (ragdollsRef.current.length > 0) {
        ragdollsRef.current = updateRagdolls(ragdollsRef.current, map, dt);
      }

      // 4. UPDATE CAMERA (Pure ref math, zero React setState)
      const camLerp = 1 - Math.pow(1 - 0.14, dt * 60);
      const { width: viewW, height: viewH, dpr } = viewportRef.current;
      currentCamera = updateCamera(
        { ...currentCamera, viewportWidth: viewW, viewportHeight: viewH },
        nextPlayer.x,
        nextPlayer.y,
        map.width,
        map.height,
        camLerp,
      );
      cameraRef.current = currentCamera;

      // 5. UPDATE BULLETS & COMBAT (Zero array-spread store churn)
      targetPlayersBuf.length = 0;
      targetPlayersBuf.push({
        id: nextPlayer.id,
        team: nextPlayer.team,
        x: nextPlayer.x,
        y: nextPlayer.y,
        radius: nextPlayer.radius,
        isDead: nextPlayer.isDead,
        isInvulnerable: nextPlayer.invulnerableTimer > 0,
      });
      for (const rp of engineWorld.remotePlayers.values()) {
        targetPlayersBuf.push({
          id: rp.id,
          team: rp.team,
          x: rp.renderX,
          y: rp.renderY,
          radius: 16,
          isDead: rp.isDead,
          isInvulnerable: rp.isInvulnerable,
        });
      }
      if (!isMultiplayer) {
        for (let i = 0; i < engineWorld.soloBots.length; i++) {
          const bot = engineWorld.soloBots[i];
          targetPlayersBuf.push({
            id: bot.id,
            team: bot.team,
            x: bot.player.x,
            y: bot.player.y,
            radius: bot.player.radius,
            isDead: bot.player.isDead,
            isInvulnerable: bot.player.invulnerableTimer > 0,
          });
        }
      }

      const { activeBullets, newParticles, hits } = updateBullets(
        engineWorld.bullets,
        map,
        targetPlayersBuf,
        dt,
      );

      for (let i = 0; i < newParticles.length; i++) {
        engineWorld.particles.push(newParticles[i]);
      }
      engineWorld.bullets = activeBullets;
      engineWorld.particles = updateParticles(engineWorld.particles, dt);

      // Process Hits (Shooter-authoritative in Multiplayer; full simulation in Solo)
      for (const hit of hits) {
        if (hit.damage <= 0) continue;
        const isFromLocal = hit.dealerId === nextPlayer.id;
        if (isMultiplayer && !isFromLocal) continue;

        if (hit.targetId === nextPlayer.id) {
          const targetLocal = engineWorld.localPlayer;
          if (targetLocal.isDead || targetLocal.invulnerableTimer > 0) continue;

          if (isFromLocal) {
            sounds.playHitMarker();
          }
          if (useSettingsStore.getState().screenShake) {
            screenShakeRef.current = Math.min(
              12,
              Math.max(screenShakeRef.current, hit.damage * 0.25),
            );
          }

          let attackerX = hit.impactX - hit.knockbackX * 20;
          let attackerY = hit.impactY - hit.knockbackY * 20;
          if (!isFromLocal && !isMultiplayer) {
            const dealerBot = engineWorld.getSoloBot(hit.dealerId);
            if (dealerBot) {
              attackerX = dealerBot.player.x;
              attackerY = dealerBot.player.y;
            }
          }
          const dmgAngle = isFromLocal
            ? Math.atan2(-hit.knockbackY, -hit.knockbackX)
            : Math.atan2(attackerY - targetLocal.y, attackerX - targetLocal.x);
          engineWorld.addDamageIndicator(dmgAngle, hit.damage);

          const carryingBeforeHit = targetLocal.carryingFlag;
          const wasKilled = playerStore.applyDamage(
            hit.damage,
            hit.knockbackX,
            hit.knockbackY,
          );

          if (wasKilled) {
            const dealerBot = !isFromLocal ? engineWorld.getSoloBot(hit.dealerId) : undefined;
            const killEvt = {
              id: `kill_${myPlayerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              killerId: isFromLocal ? myPlayerId : dealerBot?.id ?? hit.dealerId,
              killerCallsign: isFromLocal
                ? targetLocal.avatar.callsign
                : dealerBot?.player.avatar.callsign ?? 'BOT',
              killerTeam: isFromLocal
                ? targetLocal.team
                : dealerBot?.team ?? (targetLocal.team === 'blue' ? 'red' : 'blue'),
              victimId: myPlayerId,
              victimCallsign: targetLocal.avatar.callsign,
              victimTeam: targetLocal.team,
              weaponType: isFromLocal ? ('self' as const) : hit.weaponType,
            };
            if (isMultiplayer) {
              networkManager.broadcastKillFeed(killEvt);
            } else {
              useMatchStatsStore.getState().recordKill(killEvt);
            }

            if (carryingBeforeHit) {
              const enemyTeam = nextPlayer.team === 'blue' ? 'red' : 'blue';
              const updatedLocal = engineWorld.localPlayer;
              if (isAuthoritativeCTF) {
                ctfStore.dropFlag(enemyTeam, updatedLocal.x, updatedLocal.y);
              } else {
                networkManager.broadcastFlagEvent({
                  action: 'drop',
                  team: enemyTeam,
                  carrierId: myPlayerId,
                  x: updatedLocal.x,
                  y: updatedLocal.y,
                });
              }
            }
          }
        } else if (!isMultiplayer) {
          const targetBot = engineWorld.getSoloBot(hit.targetId);
          if (!targetBot || targetBot.player.isDead || targetBot.player.invulnerableTimer > 0) {
            continue;
          }

          if (isFromLocal) {
            sounds.playHitMarker();
            engineWorld.addFloatingText(
              hit.impactX,
              hit.impactY - 8,
              `-${hit.damage}${hit.isCrit ? '!' : ''}`,
              hit.isCrit ? '#38bdf8' : '#fbbf24',
              hit.isCrit ? 1.2 : 1.0,
            );
          }

          const nextHp = Math.max(0, targetBot.player.health - hit.damage);
          const botKilled = nextHp <= 0;
          const botCarryingBefore = targetBot.player.carryingFlag;

          targetBot.player = {
            ...targetBot.player,
            health: nextHp,
            isDead: botKilled,
            respawnTimer: botKilled ? ctfStore.matchRules.respawnDelaySec : 0,
            carryingFlag: botKilled ? false : targetBot.player.carryingFlag,
            vx: targetBot.player.vx + hit.knockbackX,
            vy: targetBot.player.vy + hit.knockbackY,
          };
          targetBot.lastDamagedBy = {
            dealerId: hit.dealerId,
            weaponType: hit.weaponType,
          };

          if (botKilled) {
            ragdollsRef.current.push(
              createRagdoll({
                id: `rag_${targetBot.id}_${timestamp}`,
                x: targetBot.player.x,
                y: targetBot.player.y,
                vx: targetBot.player.vx,
                vy: targetBot.player.vy,
                aimAngle: targetBot.player.aimAngle,
                team: targetBot.team,
                avatar: targetBot.player.avatar,
              }),
            );
            engineWorld.addParticles(
              createSparks(targetBot.player.x, targetBot.player.y, 14, '#ef4444'),
            );

            if (botCarryingBefore) {
              const droppedTeam = targetBot.team === 'blue' ? 'red' : 'blue';
              ctfStore.dropFlag(droppedTeam, targetBot.player.x, targetBot.player.y);
            }

            const dealerBot = !isFromLocal ? engineWorld.getSoloBot(hit.dealerId) : undefined;
            const isSelfKill = hit.dealerId === targetBot.id;
            useMatchStatsStore.getState().recordKill({
              id: `kill_${targetBot.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              killerId: isFromLocal ? myPlayerId : dealerBot?.id ?? hit.dealerId,
              killerCallsign: isFromLocal
                ? nextPlayer.avatar.callsign
                : dealerBot?.player.avatar.callsign ?? 'BOT',
              killerTeam: isFromLocal
                ? nextPlayer.team
                : dealerBot?.team ?? (targetBot.team === 'blue' ? 'red' : 'blue'),
              victimId: targetBot.id,
              victimCallsign: targetBot.player.avatar.callsign,
              victimTeam: targetBot.team,
              weaponType: isSelfKill ? 'self' : hit.weaponType,
            });
          }
        } else {
          sounds.playHitMarker();
          engineWorld.addFloatingText(
            hit.impactX,
            hit.impactY - 8,
            `-${hit.damage}${hit.isCrit ? '!' : ''}`,
            hit.isCrit ? '#38bdf8' : '#fbbf24',
            hit.isCrit ? 1.2 : 1.0,
          );
          networkManager.broadcastDamage({
            targetId: hit.targetId,
            dealerId: hit.dealerId,
            damage: hit.damage,
            knockbackX: hit.knockbackX,
            knockbackY: hit.knockbackY,
            weaponType: hit.weaponType,
            sourceX: nextPlayer.x,
            sourceY: nextPlayer.y,
          });
        }
      }

      // 6. CTF GAME LOGIC CHECK (Authoritative on Host/Solo; claim intent on Cadets)
      ctfStore.tickTimers(dt, isAuthoritativeCTF, isAuthoritativeCTF);

      const latestLocal = engineWorld.localPlayer;
      if (!latestLocal.isDead && ctfStore.matchStatus === 'playing') {
        const enemyTeam = latestLocal.team === 'blue' ? 'red' : 'blue';
        const friendlyTeam = latestLocal.team;
        const enemyFlag = ctfStore.flags[enemyTeam];
        const friendlyFlag = ctfStore.flags[friendlyTeam];
        const localActorId = isMultiplayer ? myPlayerId : latestLocal.id;

        if (enemyFlag.status !== 'carried') {
          const distToEnemyFlag = Math.hypot(
            latestLocal.x - enemyFlag.x,
            latestLocal.y - enemyFlag.y,
          );
          if (distToEnemyFlag < latestLocal.radius + 20) {
            if (isAuthoritativeCTF) {
              if (ctfStore.pickupFlag(enemyTeam, localActorId)) {
                latestLocal.carryingFlag = true;
                networkManager.notifyLocalStateChanged();
              }
            } else if (timestamp - lastFlagClaimMs > 120) {
              lastFlagClaimMs = timestamp;
              networkManager.broadcastFlagEvent({
                action: 'pickup',
                team: enemyTeam,
                carrierId: myPlayerId,
              });
            }
          }
        }

        if (friendlyFlag.status === 'dropped') {
          const distToFriendlyFlag = Math.hypot(
            latestLocal.x - friendlyFlag.x,
            latestLocal.y - friendlyFlag.y,
          );
          if (distToFriendlyFlag < latestLocal.radius + 20) {
            if (isAuthoritativeCTF) {
              ctfStore.returnFlag(friendlyTeam);
            } else if (timestamp - lastFlagClaimMs > 120) {
              lastFlagClaimMs = timestamp;
              networkManager.broadcastFlagEvent({
                action: 'return',
                team: friendlyTeam,
              });
            }
          }
        }

        if (latestLocal.carryingFlag && friendlyFlag.status === 'at_base') {
          const distToBase = Math.hypot(
            latestLocal.x - friendlyFlag.baseX,
            latestLocal.y - friendlyFlag.baseY,
          );
          if (distToBase < 42) {
            if (isAuthoritativeCTF) {
              if (ctfStore.captureFlag(friendlyTeam, latestLocal.avatar.callsign, localActorId)) {
                latestLocal.carryingFlag = false;
                networkManager.notifyLocalStateChanged();
              }
            } else if (timestamp - lastFlagClaimMs > 120) {
              lastFlagClaimMs = timestamp;
              networkManager.broadcastFlagEvent({
                action: 'capture',
                team: friendlyTeam,
                carrierId: myPlayerId,
              });
            }
          }
        }
      }

      // 7. WEAPON CRATE PICKUPS (In-place updates, zero allocations)
      const pickups = engineWorld.pickups;
      const postCtfLocal = engineWorld.localPlayer;
      for (let i = 0; i < pickups.length; i++) {
        const pickup = pickups[i];
        if (pickup.respawnTimer > 0) {
          pickup.respawnTimer = Math.max(0, pickup.respawnTimer - dt);
        } else if (!postCtfLocal.isDead) {
          const dist = Math.hypot(postCtfLocal.x - pickup.x, postCtfLocal.y - pickup.y);
          if (dist < postCtfLocal.radius + 18) {
            useCombatStore.getState().grantWeaponPickup(pickup.weaponType);
            sounds.playFlagPickup();
            pickup.respawnTimer = 20;
            if (isMultiplayer) {
              networkManager.broadcastPickupCollected(pickup.id, pickup.weaponType);
            }
          }
        }
      }

      // 7b. REFILL STATIONS (Medkit / Jetpack Fuel / Tactical Supply Pods)
      const stations = engineWorld.stations;
      for (let i = 0; i < stations.length; i++) {
        const st = stations[i];
        if (st.respawnTimer > 0) {
          st.respawnTimer = Math.max(0, st.respawnTimer - dt);
        } else if (!postCtfLocal.isDead) {
          const dist = Math.hypot(postCtfLocal.x - st.x, postCtfLocal.y - st.y);
          if (dist < postCtfLocal.radius + 18) {
            const needsHealth = postCtfLocal.health < postCtfLocal.maxHealth - 0.5;
            const needsFuel =
              postCtfLocal.boostFuel < postCtfLocal.maxFuel - 1 ||
              Boolean(postCtfLocal.fuelOverheated) ||
              (postCtfLocal.dashCooldown ?? 0) > 0.2;

            if (st.stationType === 'medkit' && needsHealth) {
              const healed = Math.min(postCtfLocal.maxHealth, postCtfLocal.health + 55);
              const gain = Math.round(healed - postCtfLocal.health);
              postCtfLocal.health = healed;
              st.respawnTimer = st.cooldownSec;
              sounds.playRefill('medkit');
              engineWorld.addParticles(createSparks(st.x, st.y, 12, '#34d399'));
              engineWorld.addFloatingText(st.x, st.y - 16, `+${gain} HP`, '#34d399', 1.05);
              if (isMultiplayer) {
                networkManager.broadcastStationCollected(st.id, st.stationType);
              }
              networkManager.notifyLocalStateChanged();
            } else if (st.stationType === 'fuel' && needsFuel) {
              postCtfLocal.boostFuel = postCtfLocal.maxFuel;
              postCtfLocal.fuelOverheated = false;
              postCtfLocal.dashCooldown = 0;
              st.respawnTimer = st.cooldownSec;
              sounds.playRefill('fuel');
              engineWorld.addParticles(createSparks(st.x, st.y, 12, '#38bdf8'));
              engineWorld.addFloatingText(st.x, st.y - 16, 'FUEL MAX', '#38bdf8', 1.0);
              if (isMultiplayer) {
                networkManager.broadcastStationCollected(st.id, st.stationType);
              }
              networkManager.notifyLocalStateChanged();
            } else if (st.stationType === 'supply' && (needsHealth || needsFuel)) {
              postCtfLocal.health = Math.min(postCtfLocal.maxHealth, postCtfLocal.health + 40);
              postCtfLocal.boostFuel = postCtfLocal.maxFuel;
              postCtfLocal.fuelOverheated = false;
              postCtfLocal.dashCooldown = 0;
              st.respawnTimer = st.cooldownSec;
              sounds.playRefill('supply');
              engineWorld.addParticles(createSparks(st.x, st.y, 14, '#c084fc'));
              engineWorld.addFloatingText(st.x, st.y - 16, 'RESUPPLY', '#c084fc', 1.05);
              if (isMultiplayer) {
                networkManager.broadcastStationCollected(st.id, st.stationType);
              }
              networkManager.notifyLocalStateChanged();
            }
          }
        }
      }

      // 8. THROTTLED HUD STORE SYNC (~10 Hz, ONLY if visible HUD numbers actually changed)
      const hudHealth = Math.ceil(postCtfLocal.health);
      const hudFuel = Math.round(postCtfLocal.boostFuel);
      const hudDead = postCtfLocal.isDead;
      const hudFlag = postCtfLocal.carryingFlag;
      const hudDashTenths = Math.ceil((postCtfLocal.dashCooldown ?? 0) * 10);
      const hudOverheated = Boolean(postCtfLocal.fuelOverheated);
      const hudChanged =
        hudHealth !== lastHudHealth ||
        hudFuel !== lastHudFuel ||
        hudDead !== lastHudDead ||
        hudFlag !== lastHudFlag ||
        hudDashTenths !== lastHudDashTenths ||
        hudOverheated !== lastHudOverheated;

      if (
        (hudDead !== lastHudDead || hudFlag !== lastHudFlag || timestamp - lastHudSync > 100) &&
        hudChanged
      ) {
        lastHudSync = timestamp;
        lastHudHealth = hudHealth;
        lastHudFuel = hudFuel;
        lastHudDead = hudDead;
        lastHudFlag = hudFlag;
        lastHudDashTenths = hudDashTenths;
        lastHudOverheated = hudOverheated;
        playerStore.setPlayer(postCtfLocal);
      }

      // 8b. VISUAL FEEDBACK DECAY (Floating Damage Text & Screen Edge Damage Arcs)
      engineWorld.stepVisualFeedback(dt);

      // 9. DIRECT MINIMAP RADAR DRAW (~15 Hz, zero React re-renders)
      const mm = engineWorld.minimapTarget;
      if (!mm.hidden && mm.canvas && timestamp - lastMinimapSync > 66) {
        lastMinimapSync = timestamp;
        const mmCtx = mm.canvas.getContext('2d');
        if (mmCtx) {
          const mmTargetW = Math.floor(mm.width * dpr);
          const mmTargetH = Math.floor(mm.height * dpr);
          if (mm.canvas.width !== mmTargetW || mm.canvas.height !== mmTargetH) {
            mm.canvas.width = mmTargetW;
            mm.canvas.height = mmTargetH;
          }
          mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

          minimapPlayersBuf.length = 0;
          minimapPlayersBuf.push({
            x: postCtfLocal.x,
            y: postCtfLocal.y,
            team: postCtfLocal.team,
            isLocal: true,
            hasFlag: postCtfLocal.carryingFlag,
          });
          for (const rp of engineWorld.remotePlayers.values()) {
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
      }

      // --- RENDERING PIPELINE ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = map.backgroundColor || '#060913';
      ctx.fillRect(0, 0, viewW, viewH);

      const parX = currentCamera.x * 0.14;
      const parY = currentCamera.y * 0.14;
      if (hazeWidth !== viewW || hazeHeight !== viewH || !hazeCanvas) {
        hazeWidth = viewW;
        hazeHeight = viewH;
        hazeCanvas = document.createElement('canvas');
        hazeCanvas.width = Math.max(1, viewW);
        hazeCanvas.height = Math.max(1, viewH);
        const hCtx = hazeCanvas.getContext('2d');
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
      ctx.drawImage(hazeCanvas, 0, 0, viewW, viewH);

      for (const star of stars) {
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
      renderRefillStations(ctx, stations, timeSec);
      renderWeaponPickups(ctx, pickups, timeSec);
      renderFlags(ctx, Object.values(useCTFStore.getState().flags), timeSec);

      for (const ragdoll of ragdollsRef.current) {
        renderRagdoll(ctx, ragdoll, timeSec);
      }

      renderBullets(ctx, engineWorld.bullets);
      renderParticles(ctx, engineWorld.particles);

      // Remote Players rendered cleanly at interpolated coordinates
      for (const rp of engineWorld.remotePlayers.values()) {
        remoteRenderScratch.id = rp.id;
        remoteRenderScratch.team = rp.team;
        remoteRenderScratch.x = rp.renderX;
        remoteRenderScratch.y = rp.renderY;
        remoteRenderScratch.vx = rp.vx;
        remoteRenderScratch.vy = rp.vy;
        remoteRenderScratch.health = rp.health;
        remoteRenderScratch.aimAngle = rp.renderAimAngle;
        remoteRenderScratch.color = rp.team === 'blue' ? '#3b82f6' : '#ef4444';
        remoteRenderScratch.avatar = rp.avatar;
        remoteRenderScratch.isDead = rp.isDead;
        remoteRenderScratch.invulnerableTimer = rp.isInvulnerable ? 1 : 0;
        remoteRenderScratch.carryingFlag = rp.carryingFlag;
        remoteRenderScratch.isGrounded = rp.isGrounded;
        renderPlayer(
          ctx,
          remoteRenderScratch,
          timeSec,
          rp.isBoosting,
          rp.weaponType,
        );
      }

      // Solo Practice AI Skirmish Bots
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
          );
        }
      }

      // Local Player
      renderPlayer(
        ctx,
        postCtfLocal,
        timeSec,
        isBoostingNow,
        useCombatStore.getState().equippedWeapon,
        true,
      );

      // Floating Damage & Crit Numbers
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

      // --- SCREEN-SPACE TACTICAL INDICATORS & RETICLE ---
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
      const enemyTeam = postCtfLocal.team === 'blue' ? 'red' : 'blue';
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
          enemyFlag.carrierId === postCtfLocal.id ||
          enemyFlag.carrierId === myPlayerId
        ) {
          targetWorldX = currentFlags[postCtfLocal.team].baseX;
          targetWorldY = currentFlags[postCtfLocal.team].baseY;
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
        const indicatorColor = postCtfLocal.carryingFlag
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
      if (!isTouchHUDRef.current && pointerPosRef.current.active) {
        const mx = pointerPosRef.current.x;
        const my = pointerPosRef.current.y;
        const gap = 5 + crosshairSpreadRef.current;
        const tickLen = 6;
        const accent = postCtfLocal.team === 'blue' ? '#38bdf8' : '#fb7185';

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

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      sounds.setJetpackBoosting(false);
    };
  }, [map, handleFire, handleSwitchWeapon]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden touch-none select-none">
      {/* 60/120 FPS Camera Viewport Canvas (HiDPI crisp) */}
      <canvas
        ref={canvasRef}
        className={`block w-full h-full bg-[#060913] touch-none ${
          isTouchHUD ? '' : 'cursor-none'
        }`}
      />

      {/* Top-Right Corner Minimap Radar (Direct-canvas updates, zero React commits) */}
      <MinimapView map={map} />

      {/* On-Screen Mobile Virtual Controls */}
      <VirtualControls onFire={handleFire} onSwitchWeapon={handleSwitchWeapon} />
    </div>
  );
}
