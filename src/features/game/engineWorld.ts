import type { AvatarConfig } from '../avatar/types';
import type {
  ActiveWeaponPickup,
  BlastVisualEffect,
  Bullet,
  ExplosionEvent,
  Particle,
  WeaponType,
} from '../combat/types';
import type { GameMode, Team } from '../ctf/types';
import type { ActiveRefillStation, GameMap } from '../map/types';
import { isNewerSeq8, normalizeAngleRad } from '../network/fastProtocol';
import { resolveCapsuleVsTerrainShapes } from '../map/terrainGeometry';
import type { Player } from '../player/types';
import { hapticDamage } from '../controls/haptics';
import {
  createSoloBotSquad,
  type BotDifficulty,
  type SoloBot,
  type SoloSquadSize,
} from './botAI';

export interface SoloSkirmishConfig {
  squadSize: SoloSquadSize;
  difficulty: BotDifficulty;
  playerTeam: Team;
  mode?: GameMode;
}

export function buildActiveStations(map: GameMap): ActiveRefillStation[] {
  return (map.refillStations || []).map((st) => ({
    id: st.id,
    x: st.x,
    y: st.y,
    stationType: st.stationType,
    cooldownSec:
      st.cooldownSec ??
      (st.stationType === 'medkit' ? 14 : st.stationType === 'fuel' ? 10 : 16),
    respawnTimer: 0,
  }));
}

const MAX_PARTICLES = 320;
const MAX_BULLETS = 220;
const MAX_FLOATING_TEXTS = 32;
const MAX_DAMAGE_INDICATORS = 6;
const MAX_BLAST_EFFECTS = 16;
const REMOTE_HALF_W = 14;
const REMOTE_HALF_H = 25;

export interface FloatingDamageText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface DamageIndicator {
  angle: number;
  intensity: number;
  life: number;
  maxLife: number;
}

export interface InterpolatedRemotePlayer {
  id: string;
  slot: number;
  team: Team;
  avatar: AvatarConfig;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  aimAngle: number;
  renderX: number;
  renderY: number;
  renderAimAngle: number;
  health: number;
  isInvulnerable: boolean;
  isBoosting: boolean;
  isDead: boolean;
  carryingFlag: boolean;
  isGrounded: boolean;
  weaponType: WeaponType;
  lastSeq: number;
  receivedAtMs: number;
}

export interface RemoteTransformInput {
  id: string;
  slot?: number;
  team: Team;
  avatar?: AvatarConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  health: number;
  isInvulnerable?: boolean;
  isBoosting: boolean;
  isDead: boolean;
  carryingFlag: boolean;
  isGrounded: boolean;
  weaponType: WeaponType;
  seq?: number;
}

export interface MinimapTargetState {
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  hidden: boolean;
}

function makeDefaultAvatar(team: Team, callsign = 'Pilot'): AvatarConfig {
  return {
    callsign,
    bodyColor: team === 'blue' ? '#2563eb' : '#dc2626',
    skinTone: '#fed7aa',
    headgear: 'soldier_helmet',
    headgearColor: '#1e293b',
    visorStyle: 'classic',
    visorColor: '#00f0ff',
    jetpackStyle: 'dual_tank',
  };
}

class GameEngineWorld {
  public localPlayer: Player | null = null;
  public bullets: Bullet[] = [];
  public particles: Particle[] = [];
  public pickups: ActiveWeaponPickup[] = [];
  public stations: ActiveRefillStation[] = [];
  public remotePlayers: Map<string, InterpolatedRemotePlayer> = new Map();
  public soloBots: SoloBot[] = [];
  public floatingTexts: FloatingDamageText[] = [];
  public damageIndicators: DamageIndicator[] = [];
  public blastEffects: BlastVisualEffect[] = [];
  public soloConfig: SoloSkirmishConfig = {
    squadSize: '2v2',
    difficulty: 'veteran',
    playerTeam: 'blue',
    mode: 'ctf',
  };
  public minimapTarget: MinimapTargetState = {
    canvas: null,
    width: 148,
    height: 82,
    hidden: false,
  };

  public setSoloConfig(patch: Partial<SoloSkirmishConfig>) {
    this.soloConfig = {
      ...this.soloConfig,
      ...patch,
    };
  }

  private localUrgentDirty = false;
  private onUrgentStateChange: (() => void) | null = null;
  private pendingPickupCooldowns = new Map<string, { remainingSec: number; capturedAtMs: number }>();
  private pendingStationCooldowns = new Map<string, { remainingSec: number; capturedAtMs: number }>();

  public setOnUrgentStateChange(cb: (() => void) | null) {
    this.onUrgentStateChange = cb;
  }

  public notifyUrgentLocalStateChange() {
    this.localUrgentDirty = true;
    this.onUrgentStateChange?.();
  }

  public consumeUrgentDirty(): boolean {
    const dirty = this.localUrgentDirty;
    this.localUrgentDirty = false;
    return dirty;
  }

  public setLocalPlayer(player: Player) {
    this.localPlayer = player;
  }

  public resetWorldForMatch(
    pickups: ActiveWeaponPickup[],
    clearPendingCooldowns: boolean = false,
    stationSpawns: ActiveRefillStation[] = [],
  ) {
    this.bullets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.damageIndicators = [];
    this.blastEffects = [];
    this.soloBots = [];
    if (clearPendingCooldowns) {
      this.pendingPickupCooldowns.clear();
      this.pendingStationCooldowns.clear();
    }
    const nowMs = performance.now();
    this.pickups = pickups.map((p) => {
      const pending = this.pendingPickupCooldowns.get(p.id);
      if (!pending) return { ...p };
      const elapsedSec = Math.max(0, (nowMs - pending.capturedAtMs) / 1000);
      const remaining = Math.max(0, pending.remainingSec - elapsedSec);
      return { ...p, respawnTimer: remaining };
    });
    if (this.pickups.length > 0) {
      this.pendingPickupCooldowns.clear();
    }

    this.stations = stationSpawns.map((s) => {
      const pending = this.pendingStationCooldowns.get(s.id);
      if (!pending) return { ...s };
      const elapsedSec = Math.max(0, (nowMs - pending.capturedAtMs) / 1000);
      const remaining = Math.max(0, pending.remainingSec - elapsedSec);
      return { ...s, respawnTimer: remaining };
    });
    if (this.stations.length > 0) {
      this.pendingStationCooldowns.clear();
    }
  }

  public addBullets(newBullets: Bullet[]) {
    if (newBullets.length === 0) return;
    for (let i = 0; i < newBullets.length; i++) {
      this.bullets.push(newBullets[i]);
    }
    if (this.bullets.length > MAX_BULLETS) {
      this.bullets.splice(0, this.bullets.length - MAX_BULLETS);
    }
  }

  public addParticles(newParticles: Particle[]) {
    if (newParticles.length === 0) return;
    for (let i = 0; i < newParticles.length; i++) {
      this.particles.push(newParticles[i]);
    }
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
  }

  public isPickupAvailable(pickupId: string): boolean {
    for (let i = 0; i < this.pickups.length; i++) {
      if (this.pickups[i].id === pickupId) {
        return this.pickups[i].respawnTimer <= 0;
      }
    }
    return false;
  }

  public markPickupTaken(pickupId: string, cooldownSec = 20) {
    for (let i = 0; i < this.pickups.length; i++) {
      if (this.pickups[i].id === pickupId) {
        this.pickups[i].respawnTimer = cooldownSec;
        return;
      }
    }
  }

  public exportPickupCooldowns(): { id: string; remainingSec: number }[] {
    const out: { id: string; remainingSec: number }[] = [];
    for (let i = 0; i < this.pickups.length; i++) {
      if (this.pickups[i].respawnTimer > 0) {
        out.push({ id: this.pickups[i].id, remainingSec: this.pickups[i].respawnTimer });
      }
    }
    return out;
  }

  public applyPickupCooldowns(cooldowns?: { id: string; remainingSec: number }[]) {
    if (!cooldowns || cooldowns.length === 0) return;
    const nowMs = performance.now();
    this.pendingPickupCooldowns.clear();
    for (let i = 0; i < cooldowns.length; i++) {
      const cd = cooldowns[i];
      if (cd.remainingSec > 0) {
        if (this.pickups.length > 0) {
          this.markPickupTaken(cd.id, cd.remainingSec);
        } else {
          this.pendingPickupCooldowns.set(cd.id, {
            remainingSec: cd.remainingSec,
            capturedAtMs: nowMs,
          });
        }
      }
    }
  }

  public isStationAvailable(stationId: string): boolean {
    for (let i = 0; i < this.stations.length; i++) {
      if (this.stations[i].id === stationId) {
        return this.stations[i].respawnTimer <= 0;
      }
    }
    return false;
  }

  public markStationTaken(stationId: string, cooldownOverrideSec?: number) {
    for (let i = 0; i < this.stations.length; i++) {
      if (this.stations[i].id === stationId) {
        this.stations[i].respawnTimer = cooldownOverrideSec ?? this.stations[i].cooldownSec;
        return;
      }
    }
  }

  public exportStationCooldowns(): { id: string; remainingSec: number }[] {
    const out: { id: string; remainingSec: number }[] = [];
    for (let i = 0; i < this.stations.length; i++) {
      if (this.stations[i].respawnTimer > 0) {
        out.push({ id: this.stations[i].id, remainingSec: this.stations[i].respawnTimer });
      }
    }
    return out;
  }

  public applyStationCooldowns(cooldowns?: { id: string; remainingSec: number }[]) {
    if (!cooldowns || cooldowns.length === 0) return;
    const nowMs = performance.now();
    this.pendingStationCooldowns.clear();
    for (let i = 0; i < cooldowns.length; i++) {
      const cd = cooldowns[i];
      if (cd.remainingSec > 0) {
        if (this.stations.length > 0) {
          this.markStationTaken(cd.id, cd.remainingSec);
        } else {
          this.pendingStationCooldowns.set(cd.id, {
            remainingSec: cd.remainingSec,
            capturedAtMs: nowMs,
          });
        }
      }
    }
  }

  public upsertRemoteTransform(
    incoming: RemoteTransformInput,
    nowMs: number = performance.now(),
  ) {
    const existing = this.remotePlayers.get(incoming.id);
    const incomingSeq = incoming.seq;

    if (!existing) {
      this.remotePlayers.set(incoming.id, {
        id: incoming.id,
        slot: incoming.slot ?? 0,
        team: incoming.team,
        avatar: incoming.avatar ?? makeDefaultAvatar(incoming.team),
        targetX: incoming.x,
        targetY: incoming.y,
        vx: incoming.vx,
        vy: incoming.vy,
        aimAngle: incoming.aimAngle,
        renderX: incoming.x,
        renderY: incoming.y,
        renderAimAngle: incoming.aimAngle,
        health: incoming.health,
        isInvulnerable: Boolean(incoming.isInvulnerable),
        isBoosting: incoming.isBoosting,
        isDead: incoming.isDead,
        carryingFlag: incoming.carryingFlag,
        isGrounded: incoming.isGrounded,
        weaponType: incoming.weaponType,
        lastSeq: incomingSeq ?? 0,
        receivedAtMs: nowMs,
      });
      return;
    }

    // Reject stale out-of-order UDP frames unless sender restarted stream (>550ms silence)
    if (incomingSeq !== undefined) {
      const elapsed = nowMs - existing.receivedAtMs;
      if (
        elapsed < 550 &&
        incomingSeq !== existing.lastSeq &&
        !isNewerSeq8(incomingSeq, existing.lastSeq)
      ) {
        return;
      }
      existing.lastSeq = incomingSeq;
    }

    const respawned = existing.isDead && !incoming.isDead;
    const teleported =
      Math.hypot(incoming.x - existing.renderX, incoming.y - existing.renderY) > 190;

    if (incoming.slot !== undefined) existing.slot = incoming.slot;
    existing.team = incoming.team;
    if (incoming.avatar) existing.avatar = incoming.avatar;
    existing.targetX = incoming.x;
    existing.targetY = incoming.y;
    existing.vx = incoming.vx;
    existing.vy = incoming.vy;
    existing.aimAngle = incoming.aimAngle;
    existing.health = incoming.health;
    existing.isInvulnerable = Boolean(incoming.isInvulnerable);
    existing.isBoosting = incoming.isBoosting;
    existing.isDead = incoming.isDead;
    existing.carryingFlag = incoming.carryingFlag;
    existing.isGrounded = incoming.isGrounded;
    existing.weaponType = incoming.weaponType;
    existing.receivedAtMs = nowMs;

    if (respawned || teleported) {
      existing.renderX = incoming.x;
      existing.renderY = incoming.y;
      existing.renderAimAngle = incoming.aimAngle;
    }
  }

  public syncRemoteMetadata(id: string, team: Team, avatar?: AvatarConfig, slot?: number) {
    const existing = this.remotePlayers.get(id);
    if (!existing) return;
    existing.team = team;
    if (avatar) existing.avatar = avatar;
    if (slot !== undefined) existing.slot = slot;
  }

  public removeRemotePlayer(id: string) {
    this.remotePlayers.delete(id);
  }

  public clearRemotePlayers() {
    this.remotePlayers.clear();
  }

  public stepRemotePlayers(
    dt: number,
    nowMs: number = performance.now(),
    map?: GameMap,
  ) {
    if (this.remotePlayers.size === 0) return;

    const blend = 1 - Math.exp(-22 * dt);

    for (const rp of this.remotePlayers.values()) {
      if (rp.isDead) {
        rp.renderX += (rp.targetX - rp.renderX) * blend;
        rp.renderY += (rp.targetY - rp.renderY) * blend;
        continue;
      }

      const ageSec = Math.min(0.11, Math.max(0, (nowMs - rp.receivedAtMs) / 1000));
      const framesAhead = ageSec * 60;
      const hasVelocity = rp.vx * rp.vx + rp.vy * rp.vy > 0.0025;
      let predX = hasVelocity ? rp.targetX + rp.vx * framesAhead : rp.targetX;
      let predY = hasVelocity
        ? rp.targetY + rp.vy * framesAhead + (rp.isGrounded ? 0 : 0.105 * framesAhead * framesAhead)
        : rp.targetY;

      if (map) {
        if (predX < REMOTE_HALF_W) predX = REMOTE_HALF_W;
        else if (predX > map.width - REMOTE_HALF_W) predX = map.width - REMOTE_HALF_W;
        if (predY < REMOTE_HALF_H) predY = REMOTE_HALF_H;
        else if (predY > map.height - REMOTE_HALF_H) predY = map.height - REMOTE_HALF_H;

        for (let i = 0; i < map.obstacles.length; i++) {
          const obs = map.obstacles[i];
          if (obs.type !== 'wall' && obs.type !== 'ground') continue;
          if (
            predX + REMOTE_HALF_W > obs.x &&
            predX - REMOTE_HALF_W < obs.x + obs.width &&
            predY + REMOTE_HALF_H > obs.y &&
            predY - REMOTE_HALF_H < obs.y + obs.height
          ) {
            const pushLeft = predX + REMOTE_HALF_W - obs.x;
            const pushRight = obs.x + obs.width - (predX - REMOTE_HALF_W);
            const pushTop = predY + REMOTE_HALF_H - obs.y;
            const pushBottom = obs.y + obs.height - (predY - REMOTE_HALF_H);
            const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
            if (minPush === pushTop) predY = obs.y - REMOTE_HALF_H;
            else if (minPush === pushBottom) predY = obs.y + obs.height + REMOTE_HALF_H;
            else if (minPush === pushLeft) predX = obs.x - REMOTE_HALF_W;
            else predX = obs.x + obs.width + REMOTE_HALF_W;
          }
        }

        if (map.terrainShapes && map.terrainShapes.length > 0) {
          const resolved = resolveCapsuleVsTerrainShapes(
            predX,
            predY,
            0,
            0,
            REMOTE_HALF_W,
            REMOTE_HALF_H,
            map,
          );
          predX = Math.max(REMOTE_HALF_W, Math.min(map.width - REMOTE_HALF_W, resolved.x));
          predY = Math.max(REMOTE_HALF_H, Math.min(map.height - REMOTE_HALF_H, resolved.y));
        }
      }

      rp.renderX += (predX - rp.renderX) * blend;
      rp.renderY += (predY - rp.renderY) * blend;

      const aimDiff = normalizeAngleRad(rp.aimAngle - rp.renderAimAngle);
      rp.renderAimAngle = normalizeAngleRad(rp.renderAimAngle + aimDiff * blend);
    }
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number = 1,
  ) {
    this.floatingTexts.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 28,
      vy: -56 - Math.random() * 18,
      text,
      color,
      life: 0.65,
      maxLife: 0.65,
      scale,
    });
    if (this.floatingTexts.length > MAX_FLOATING_TEXTS) {
      this.floatingTexts.splice(0, this.floatingTexts.length - MAX_FLOATING_TEXTS);
    }
  }

  public addBlastEffect(evt: ExplosionEvent) {
    this.blastEffects.push({
      x: evt.x,
      y: evt.y,
      radius: evt.radius,
      weaponType: evt.weaponType,
      age: 0,
      duration: evt.weaponType === 'grenade' ? 0.56 : 0.48,
    });
    if (this.blastEffects.length > MAX_BLAST_EFFECTS) {
      this.blastEffects.splice(0, this.blastEffects.length - MAX_BLAST_EFFECTS);
    }
  }

  public addDamageIndicator(angle: number, damage: number) {
    hapticDamage();
    const intensity = Math.min(1, Math.max(0.35, damage / 45));
    this.damageIndicators.push({
      angle,
      intensity,
      life: 0.45,
      maxLife: 0.45,
    });
    if (this.damageIndicators.length > MAX_DAMAGE_INDICATORS) {
      this.damageIndicators.splice(0, this.damageIndicators.length - MAX_DAMAGE_INDICATORS);
    }
  }

  public stepVisualFeedback(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      } else {
        ft.x += ft.vx * dt;
        ft.y += ft.vy * dt;
        ft.vy += 45 * dt;
      }
    }

    for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
      this.damageIndicators[i].life -= dt;
      if (this.damageIndicators[i].life <= 0) {
        this.damageIndicators.splice(i, 1);
      }
    }

    for (let i = this.blastEffects.length - 1; i >= 0; i--) {
      const fx = this.blastEffects[i];
      fx.age += dt;
      if (fx.age >= fx.duration) {
        this.blastEffects.splice(i, 1);
      }
    }
  }

  public spawnSoloBots(
    map: GameMap,
    localTeam: Team,
    configOverride?: Partial<SoloSkirmishConfig>,
  ) {
    const squadSize = configOverride?.squadSize ?? this.soloConfig.squadSize;
    const difficulty = configOverride?.difficulty ?? this.soloConfig.difficulty;
    const mode = configOverride?.mode ?? this.soloConfig.mode ?? 'ctf';
    this.soloBots = createSoloBotSquad(map, localTeam, { squadSize, difficulty, mode });
  }

  public clearSoloBots() {
    this.soloBots = [];
  }

  public getSoloBot(id: string): SoloBot | undefined {
    for (let i = 0; i < this.soloBots.length; i++) {
      if (this.soloBots[i].id === id) return this.soloBots[i];
    }
    return undefined;
  }

  public setMinimapTarget(
    canvas: HTMLCanvasElement | null,
    width: number,
    height: number,
    hidden: boolean,
  ) {
    this.minimapTarget = { canvas, width, height, hidden };
  }
}

export const engineWorld = new GameEngineWorld();
