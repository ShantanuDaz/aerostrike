import type { MutableRefObject } from 'react';
import type { WeaponType } from '../combat/types';
import type { BulletCollisionResult } from '../combat/updateBullets';
import { createSparks, useMatchStatsStore } from '../combat';
import type { Team } from '../ctf/types';
import { useCTFStore } from '../ctf/ctfStore';
import { sounds } from '../audio/soundEngine';
import { useSettingsStore } from '../settings/settingsStore';
import { usePlayerStore, createRagdoll, type RagdollInstance } from '../player';
import { networkManager } from '../network/peerRoom';
import type { KillFeedEvent } from '../network/types';
import { engineWorld } from './engineWorld';
import type { SoloBot } from './botAI';

export const HAZARD_ASSIST_WINDOW_MS = 6000;

export interface AttackerAttribution {
  dealerId: string;
  weaponType: WeaponType;
  atMs?: number;
}

export interface HazardKillContext {
  victimId: string;
  victimCallsign: string;
  victimTeam: Team;
  localPlayer: {
    id: string;
    team: Team;
    callsign: string;
  };
  localPlayerId: string;
  recentAttacker?: AttackerAttribution | null;
  getBot?: (id: string) => SoloBot | undefined;
  getRemote?: (id: string) => { id: string; team: Team; callsign: string } | undefined;
  isMultiplayer: boolean;
  nowMs: number;
}

/**
 * Resolves hazard kill attribution: credits an opposing shooter if they damaged
 * the victim within HAZARD_ASSIST_WINDOW_MS before falling into an arena hazard.
 */
export function resolveHazardKillAttribution(ctx: HazardKillContext): KillFeedEvent {
  const {
    victimId,
    victimCallsign,
    victimTeam,
    localPlayer,
    localPlayerId,
    recentAttacker,
    getBot,
    getRemote,
    isMultiplayer,
    nowMs,
  } = ctx;

  const isRecentAttacker =
    recentAttacker &&
    recentAttacker.dealerId &&
    recentAttacker.dealerId !== victimId &&
    (recentAttacker.atMs === undefined || nowMs - recentAttacker.atMs <= HAZARD_ASSIST_WINDOW_MS);

  if (isRecentAttacker) {
    const dealerIsLocal =
      recentAttacker.dealerId === localPlayer.id || recentAttacker.dealerId === localPlayerId;
    if (dealerIsLocal && localPlayer.team !== victimTeam) {
      return {
        id: `kill_${victimId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        killerId: localPlayerId,
        killerCallsign: localPlayer.callsign,
        killerTeam: localPlayer.team,
        victimId,
        victimCallsign,
        victimTeam,
        weaponType: recentAttacker.weaponType,
      };
    }

    if (!isMultiplayer && getBot) {
      const attackerBot = getBot(recentAttacker.dealerId);
      if (attackerBot && attackerBot.team !== victimTeam) {
        return {
          id: `kill_${victimId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          killerId: attackerBot.id,
          killerCallsign: attackerBot.player.avatar.callsign,
          killerTeam: attackerBot.team,
          victimId,
          victimCallsign,
          victimTeam,
          weaponType: recentAttacker.weaponType,
        };
      }
    }

    if (isMultiplayer && getRemote) {
      const attackerRemote = getRemote(recentAttacker.dealerId);
      if (attackerRemote && attackerRemote.team !== victimTeam) {
        return {
          id: `kill_${victimId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          killerId: attackerRemote.id,
          killerCallsign: attackerRemote.callsign,
          killerTeam: attackerRemote.team,
          victimId,
          victimCallsign,
          victimTeam,
          weaponType: recentAttacker.weaponType,
        };
      }
    }
  }

  return {
    id: `kill_${victimId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    killerId: 'hazard',
    killerCallsign: 'ARENA',
    killerTeam: victimTeam === 'blue' ? 'red' : 'blue',
    victimId,
    victimCallsign,
    victimTeam,
    weaponType: 'hazard',
  };
}

export interface ProcessBulletHitsParams {
  hits: BulletCollisionResult['hits'];
  localPlayerId: string;
  myPlayerId: string;
  localTeam: Team;
  localCallsign: string;
  localX: number;
  localY: number;
  isMultiplayer: boolean;
  isAuthoritativeCTF: boolean;
  timestamp: number;
  screenShakeRef: MutableRefObject<number>;
  ragdollsRef: MutableRefObject<RagdollInstance[]>;
  lastLocalAttackerRef: MutableRefObject<AttackerAttribution | null>;
}

/**
 * Processes swept bullet/splash hits for local player, solo bots, and remote multiplayer peers.
 */
export function processBulletHits(params: ProcessBulletHitsParams) {
  const {
    hits,
    localPlayerId,
    myPlayerId,
    localTeam,
    localCallsign,
    localX,
    localY,
    isMultiplayer,
    isAuthoritativeCTF,
    timestamp,
    screenShakeRef,
    ragdollsRef,
    lastLocalAttackerRef,
  } = params;

  const playerStore = usePlayerStore.getState();
  const ctfStore = useCTFStore.getState();

  for (const hit of hits) {
    if (hit.damage <= 0) continue;
    const isFromLocal = hit.dealerId === localPlayerId;
    if (isMultiplayer && !isFromLocal) continue;

    if (hit.targetId === localPlayerId) {
      const targetLocal = engineWorld.localPlayer ?? playerStore.player;
      if (targetLocal.isDead || targetLocal.invulnerableTimer > 0) continue;

      if (isFromLocal) {
        sounds.playHitMarker();
      } else {
        lastLocalAttackerRef.current = {
          dealerId: hit.dealerId,
          weaponType: hit.weaponType,
          atMs: timestamp,
        };
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
        const killEvt: KillFeedEvent = {
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
          weaponType: isFromLocal ? 'self' : hit.weaponType,
        };
        if (isMultiplayer) {
          networkManager.broadcastKillFeed(killEvt);
        } else {
          useMatchStatsStore.getState().recordKill(killEvt);
        }
        useMatchStatsStore.getState().setLocalDeathSummary({
          killerCallsign: killEvt.killerCallsign,
          killerTeam: killEvt.killerTeam,
          weaponType: killEvt.weaponType,
          atMs: Date.now(),
        });

        if (carryingBeforeHit) {
          const enemyTeam: Team = localTeam === 'blue' ? 'red' : 'blue';
          const updatedLocal = engineWorld.localPlayer ?? targetLocal;
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
        atMs: timestamp,
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
          const droppedTeam: Team = targetBot.team === 'blue' ? 'red' : 'blue';
          ctfStore.dropFlag(droppedTeam, targetBot.player.x, targetBot.player.y);
        }

        const dealerBot = !isFromLocal ? engineWorld.getSoloBot(hit.dealerId) : undefined;
        const isSelfKill = hit.dealerId === targetBot.id;
        useMatchStatsStore.getState().recordKill({
          id: `kill_${targetBot.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          killerId: isFromLocal ? myPlayerId : dealerBot?.id ?? hit.dealerId,
          killerCallsign: isFromLocal
            ? localCallsign
            : dealerBot?.player.avatar.callsign ?? 'BOT',
          killerTeam: isFromLocal
            ? localTeam
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
        sourceX: localX,
        sourceY: localY,
      });
    }
  }
}
