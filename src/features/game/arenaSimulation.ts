import type { MutableRefObject } from 'react';
import type { GameMap } from '../map/types';
import {
  updatePlayer,
  usePlayerStore,
  createRagdoll,
  updateRagdolls,
  type Player,
  type RagdollInstance,
} from '../player';
import { updateCamera, type Camera } from '../camera';
import {
  updateBullets,
  updateParticles,
  createSparks,
  useCombatStore,
  useMatchStatsStore,
  type TargetPlayer,
} from '../combat';
import {
  recordOptimisticPickupClaim,
  recordOptimisticStationClaim,
} from '../combat/optimisticClaims';
import { useCTFStore } from '../ctf';
import type { Team } from '../ctf/types';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { useAvatarStore } from '../avatar/avatarStore';
import { sounds } from '../audio/soundEngine';
import { useSettingsStore } from '../settings/settingsStore';
import { engineWorld } from './engineWorld';
import { stepSoloBots } from './botAI';
import {
  processBulletHits,
  resolveHazardKillAttribution,
  type AttackerAttribution,
} from './combatHitProcessor';
import { syncAndRenderMinimap, type ArenaRenderScratch } from './arenaRenderer';

export interface ArenaSimState {
  lastMinimapSync: number;
  lastHudSync: number;
  lastHudHealth: number;
  lastHudFuel: number;
  lastHudDead: boolean;
  lastHudFlag: boolean;
  lastHudDashTenths: number;
  lastHudOverheated: boolean;
  lastPrevBoosting: boolean;
  lastPrevGrounded: boolean;
  lastFlagClaimMs: number;
  wasPlayingLastFrame: boolean;
  prevBotDashing: Set<string>;
  prevBotBouncing: Set<string>;
  targetPlayersBuf: TargetPlayer[];
}

export function createArenaSimState(): ArenaSimState {
  return {
    lastMinimapSync: 0,
    lastHudSync: 0,
    lastHudHealth: -1,
    lastHudFuel: -1,
    lastHudDead: false,
    lastHudFlag: false,
    lastHudDashTenths: -1,
    lastHudOverheated: false,
    lastPrevBoosting: false,
    lastPrevGrounded: false,
    lastFlagClaimMs: 0,
    wasPlayingLastFrame: true,
    prevBotDashing: new Set(),
    prevBotBouncing: new Set(),
    targetPlayersBuf: [],
  };
}

export interface StepArenaFrameParams {
  map: GameMap;
  dt: number;
  timestamp: number;
  viewW: number;
  viewH: number;
  dpr: number;
  isMouseDown: boolean;
  clearAllInputs: () => void;
  handleFire: () => void;
  simState: ArenaSimState;
  renderScratch: ArenaRenderScratch;
  cameraRef: MutableRefObject<Camera>;
  needsCameraSnapRef: MutableRefObject<boolean>;
  screenShakeRef: MutableRefObject<number>;
  ragdollsRef: MutableRefObject<RagdollInstance[]>;
  prevDeadMapRef: MutableRefObject<Map<string, boolean>>;
  prevLocalDeadRef: MutableRefObject<boolean>;
  lastLocalAttackerRef: MutableRefObject<AttackerAttribution | null>;
}

export interface StepArenaFrameResult {
  localPlayer: Player;
  myPlayerId: string;
  isBoostingNow: boolean;
  isMultiplayer: boolean;
  currentCamera: Camera;
}

export function stepArenaFrame(params: StepArenaFrameParams): StepArenaFrameResult {
  const {
    map,
    dt,
    timestamp,
    viewW,
    viewH,
    dpr,
    isMouseDown,
    clearAllInputs,
    handleFire,
    simState,
    renderScratch,
    cameraRef,
    needsCameraSnapRef,
    screenShakeRef,
    ragdollsRef,
    prevDeadMapRef,
    prevLocalDeadRef,
    lastLocalAttackerRef,
  } = params;

  const playerStore = usePlayerStore.getState();
  const ctfStore = useCTFStore.getState();
  const networkStore = useNetworkStore.getState();
  const myPlayerId = useAvatarStore.getState().playerId;
  const isMultiplayer = Boolean(networkStore.roomCode);
  const isAuthoritativeCTF = !isMultiplayer || networkStore.isHost;

  // Tick authoritative CTF match & round-reset timers first
  ctfStore.tickTimers(dt, isAuthoritativeCTF, isAuthoritativeCTF);
  const activeStatus = useCTFStore.getState().matchStatus;
  const isMatchPlaying = activeStatus === 'playing';

  if (!isMatchPlaying && simState.wasPlayingLastFrame) {
    clearAllInputs();
    engineWorld.bullets = [];
  }
  simState.wasPlayingLastFrame = isMatchPlaying;

  if (isMatchPlaying && (isMouseDown || playerStore.input.shooting)) {
    handleFire();
  }

  // 1. UPDATE LOCAL PLAYER PHYSICS directly in engineWorld (Zero React commit)
  let nextPlayer = engineWorld.localPlayer ?? playerStore.player;
  let isBoostingNow = false;

  if (isMatchPlaying) {
    const currentLocal = nextPlayer;
    const wasLocalDead = prevLocalDeadRef.current;
    const wasLocalAliveBeforePhysics = !currentLocal.isDead;
    const wasLocalDashing = (currentLocal.dashActiveTimer ?? 0) > 0;
    const wasLocalBouncing = (currentLocal.bounceCooldownTimer ?? 0) > 0;
    const prevCarryingFlag = currentLocal.carryingFlag;

    nextPlayer = updatePlayer(
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

    if (wasLocalDead && !nextPlayer.isDead) {
      lastLocalAttackerRef.current = null;
      useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
    }

    isBoostingNow =
      playerStore.input.boosting &&
      !nextPlayer.fuelOverheated &&
      nextPlayer.boostFuel > 0 &&
      !nextPlayer.isDead;
    const groundedNow = Boolean(nextPlayer.isGrounded);
    const discreteEdge =
      wasLocalDead !== nextPlayer.isDead ||
      prevCarryingFlag !== nextPlayer.carryingFlag ||
      simState.lastPrevBoosting !== isBoostingNow ||
      simState.lastPrevGrounded !== groundedNow;

    simState.lastPrevBoosting = isBoostingNow;
    simState.lastPrevGrounded = groundedNow;

    if (discreteEdge) {
      networkManager.notifyLocalStateChanged();
    }

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
        const hazardEvt = resolveHazardKillAttribution({
          victimId: myPlayerId,
          victimCallsign: nextPlayer.avatar.callsign,
          victimTeam: nextPlayer.team,
          localPlayer: {
            id: nextPlayer.id,
            team: nextPlayer.team,
            callsign: nextPlayer.avatar.callsign,
          },
          localPlayerId: myPlayerId,
          recentAttacker: lastLocalAttackerRef.current,
          getBot: (id) => engineWorld.getSoloBot(id),
          getRemote: (id) => {
            const rp = engineWorld.remotePlayers.get(id);
            return rp ? { id: rp.id, team: rp.team, callsign: rp.avatar.callsign } : undefined;
          },
          isMultiplayer,
          nowMs: timestamp,
        });
        if (isMultiplayer) {
          networkManager.broadcastKillFeed(hazardEvt);
        } else {
          useMatchStatsStore.getState().recordKill(hazardEvt);
        }
      }

      if (prevCarryingFlag) {
        const enemyTeam: Team = nextPlayer.team === 'blue' ? 'red' : 'blue';
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
  }

  // 2. INTERPOLATE & DEAD-RECKON REMOTE PLAYERS
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

  // 2b. SOLO SKIRMISH AI SQUAD UPDATE
  if (isMatchPlaying && !isMultiplayer && engineWorld.soloBots.length > 0) {
    simState.prevBotDashing.clear();
    simState.prevBotBouncing.clear();
    for (let i = 0; i < engineWorld.soloBots.length; i++) {
      const b = engineWorld.soloBots[i];
      if ((b.player.dashActiveTimer ?? 0) > 0) simState.prevBotDashing.add(b.id);
      if ((b.player.bounceCooldownTimer ?? 0) > 0) simState.prevBotBouncing.add(b.id);
    }

    const botStep = stepSoloBots({
      bots: engineWorld.soloBots,
      localPlayer: nextPlayer,
      map,
      flags: useCTFStore.getState().flags,
      matchStatus: activeStatus,
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
      if ((b.player.dashActiveTimer ?? 0) > 0 && !simState.prevBotDashing.has(b.id)) {
        const dashColor = b.team === 'blue' ? '#38bdf8' : '#fb7185';
        engineWorld.addParticles(createSparks(b.player.x, b.player.y, 10, dashColor));
      }
      if ((b.player.bounceCooldownTimer ?? 0) > 0.14 && !simState.prevBotBouncing.has(b.id)) {
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

      const hazardKillEvt = resolveHazardKillAttribution({
        victimId: b.id,
        victimCallsign: b.player.avatar.callsign,
        victimTeam: b.team,
        localPlayer: {
          id: nextPlayer.id,
          team: nextPlayer.team,
          callsign: nextPlayer.avatar.callsign,
        },
        localPlayerId: myPlayerId,
        recentAttacker: b.lastDamagedBy,
        getBot: (id) => engineWorld.getSoloBot(id),
        isMultiplayer: false,
        nowMs: timestamp,
      });
      useMatchStatsStore.getState().recordKill(hazardKillEvt);
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

  // 4. UPDATE CAMERA (snaps cleanly on map / rematch reset)
  const camLerp = needsCameraSnapRef.current ? 1.0 : 1 - Math.pow(1 - 0.14, dt * 60);
  needsCameraSnapRef.current = false;
  const latestPlayer = engineWorld.localPlayer ?? nextPlayer;
  const currentCamera = updateCamera(
    { ...cameraRef.current, viewportWidth: viewW, viewportHeight: viewH },
    latestPlayer.x,
    latestPlayer.y,
    map.width,
    map.height,
    camLerp,
  );
  cameraRef.current = currentCamera;

  // 5. UPDATE BULLETS & COMBAT
  if (isMatchPlaying) {
    simState.targetPlayersBuf.length = 0;
    simState.targetPlayersBuf.push({
      id: nextPlayer.id,
      team: nextPlayer.team,
      x: nextPlayer.x,
      y: nextPlayer.y,
      radius: nextPlayer.radius,
      isDead: nextPlayer.isDead,
      isInvulnerable: nextPlayer.invulnerableTimer > 0,
    });
    for (const rp of engineWorld.remotePlayers.values()) {
      simState.targetPlayersBuf.push({
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
        simState.targetPlayersBuf.push({
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
      simState.targetPlayersBuf,
      dt,
    );

    for (let i = 0; i < newParticles.length; i++) {
      engineWorld.particles.push(newParticles[i]);
    }
    engineWorld.bullets = activeBullets;

    if (hits.length > 0) {
      processBulletHits({
        hits,
        localPlayerId: nextPlayer.id,
        myPlayerId,
        localTeam: nextPlayer.team,
        localCallsign: nextPlayer.avatar.callsign,
        localX: nextPlayer.x,
        localY: nextPlayer.y,
        isMultiplayer,
        isAuthoritativeCTF,
        timestamp,
        screenShakeRef,
        ragdollsRef,
        lastLocalAttackerRef,
      });
    }
  }
  engineWorld.particles = updateParticles(engineWorld.particles, dt);

  // 6. CTF OBJECTIVE TRIGGERS & PICKUPS/STATIONS (Active combat only)
  const latestLocal = engineWorld.localPlayer ?? nextPlayer;
  if (isMatchPlaying && !latestLocal.isDead) {
    const latestCTF = useCTFStore.getState();
    const enemyTeam: Team = latestLocal.team === 'blue' ? 'red' : 'blue';
    const friendlyTeam: Team = latestLocal.team;
    const enemyFlag = latestCTF.flags[enemyTeam];
    const friendlyFlag = latestCTF.flags[friendlyTeam];
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
        } else if (timestamp - simState.lastFlagClaimMs > 120) {
          simState.lastFlagClaimMs = timestamp;
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
        } else if (timestamp - simState.lastFlagClaimMs > 120) {
          simState.lastFlagClaimMs = timestamp;
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
        } else if (timestamp - simState.lastFlagClaimMs > 120) {
          simState.lastFlagClaimMs = timestamp;
          networkManager.broadcastFlagEvent({
            action: 'capture',
            team: friendlyTeam,
            carrierId: myPlayerId,
          });
        }
      }
    }
  }

  // 7. WEAPON CRATE PICKUPS
  const pickups = engineWorld.pickups;
  const postCtfLocal = engineWorld.localPlayer ?? latestLocal;
  const canClaimWorldItems = isMatchPlaying && !postCtfLocal.isDead;
  const shouldRecordOptimistic = isMultiplayer && !networkStore.isHost;

  for (let i = 0; i < pickups.length; i++) {
    const pickup = pickups[i];
    if (pickup.respawnTimer > 0) {
      pickup.respawnTimer = Math.max(0, pickup.respawnTimer - dt);
    } else if (canClaimWorldItems) {
      const dist = Math.hypot(postCtfLocal.x - pickup.x, postCtfLocal.y - pickup.y);
      if (dist < postCtfLocal.radius + 18) {
        if (shouldRecordOptimistic) {
          const combatBefore = useCombatStore.getState();
          recordOptimisticPickupClaim(
            pickup.id,
            pickup.weaponType,
            combatBefore.equippedWeapon,
            combatBefore.ammoByWeapon[pickup.weaponType] ?? 0,
          );
        }
        useCombatStore.getState().grantWeaponPickup(pickup.weaponType);
        sounds.playFlagPickup();
        pickup.respawnTimer = 20;
        if (isMultiplayer) {
          networkManager.broadcastPickupCollected(pickup.id, pickup.weaponType);
        }
      }
    }
  }

  // 7b. REFILL STATIONS
  const stations = engineWorld.stations;
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    if (st.respawnTimer > 0) {
      st.respawnTimer = Math.max(0, st.respawnTimer - dt);
    } else if (canClaimWorldItems) {
      const dist = Math.hypot(postCtfLocal.x - st.x, postCtfLocal.y - st.y);
      if (dist < postCtfLocal.radius + 18) {
        const needsHealth = postCtfLocal.health < postCtfLocal.maxHealth - 0.5;
        const needsFuel =
          postCtfLocal.boostFuel < postCtfLocal.maxFuel - 1 ||
          Boolean(postCtfLocal.fuelOverheated) ||
          (postCtfLocal.dashCooldown ?? 0) > 0.2;

        const prevFuel = postCtfLocal.boostFuel;
        const prevOverheated = Boolean(postCtfLocal.fuelOverheated);
        const prevDashCd = postCtfLocal.dashCooldown ?? 0;

        if (st.stationType === 'medkit' && needsHealth) {
          const healed = Math.min(postCtfLocal.maxHealth, postCtfLocal.health + 55);
          const actualGain = healed - postCtfLocal.health;
          const gainText = Math.round(actualGain);
          if (shouldRecordOptimistic) {
            recordOptimisticStationClaim(
              st.id,
              st.stationType,
              actualGain,
              prevFuel,
              prevOverheated,
              prevDashCd,
            );
          }
          postCtfLocal.health = healed;
          st.respawnTimer = st.cooldownSec;
          sounds.playRefill('medkit');
          engineWorld.addParticles(createSparks(st.x, st.y, 12, '#34d399'));
          engineWorld.addFloatingText(st.x, st.y - 16, `+${gainText} HP`, '#34d399', 1.05);
          if (isMultiplayer) {
            networkManager.broadcastStationCollected(st.id, st.stationType);
          }
          networkManager.notifyLocalStateChanged();
        } else if (st.stationType === 'fuel' && needsFuel) {
          if (shouldRecordOptimistic) {
            recordOptimisticStationClaim(
              st.id,
              st.stationType,
              0,
              prevFuel,
              prevOverheated,
              prevDashCd,
            );
          }
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
          const healed = Math.min(postCtfLocal.maxHealth, postCtfLocal.health + 40);
          const actualGain = healed - postCtfLocal.health;
          if (shouldRecordOptimistic) {
            recordOptimisticStationClaim(
              st.id,
              st.stationType,
              actualGain,
              prevFuel,
              prevOverheated,
              prevDashCd,
            );
          }
          postCtfLocal.health = healed;
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

  // 8. THROTTLED HUD STORE SYNC
  const hudHealth = Math.ceil(postCtfLocal.health);
  const hudFuel = Math.round(postCtfLocal.boostFuel);
  const hudDead = postCtfLocal.isDead;
  const hudFlag = postCtfLocal.carryingFlag;
  const hudDashTenths = Math.ceil((postCtfLocal.dashCooldown ?? 0) * 10);
  const hudOverheated = Boolean(postCtfLocal.fuelOverheated);
  const hudChanged =
    hudHealth !== simState.lastHudHealth ||
    hudFuel !== simState.lastHudFuel ||
    hudDead !== simState.lastHudDead ||
    hudFlag !== simState.lastHudFlag ||
    hudDashTenths !== simState.lastHudDashTenths ||
    hudOverheated !== simState.lastHudOverheated;

  if (
    (hudDead !== simState.lastHudDead ||
      hudFlag !== simState.lastHudFlag ||
      timestamp - simState.lastHudSync > 100) &&
    hudChanged
  ) {
    simState.lastHudSync = timestamp;
    simState.lastHudHealth = hudHealth;
    simState.lastHudFuel = hudFuel;
    simState.lastHudDead = hudDead;
    simState.lastHudFlag = hudFlag;
    simState.lastHudDashTenths = hudDashTenths;
    simState.lastHudOverheated = hudOverheated;
    playerStore.setPlayer(postCtfLocal);
  }

  // 8b. VISUAL FEEDBACK DECAY
  engineWorld.stepVisualFeedback(dt);

  // 9. DIRECT MINIMAP RADAR DRAW (~15 Hz)
  if (!engineWorld.minimapTarget.hidden && engineWorld.minimapTarget.canvas && timestamp - simState.lastMinimapSync > 66) {
    simState.lastMinimapSync = timestamp;
    syncAndRenderMinimap(
      map,
      currentCamera,
      postCtfLocal,
      dpr,
      isMultiplayer,
      renderScratch.minimapPlayersBuf,
    );
  }

  return {
    localPlayer: postCtfLocal,
    myPlayerId,
    isBoostingNow,
    isMultiplayer,
    currentCamera,
  };
}
