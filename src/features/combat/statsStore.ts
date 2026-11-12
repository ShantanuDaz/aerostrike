import { create } from 'zustand';
import type { WeaponType } from './types';
import type { Team } from '../ctf/types';
import type { KillFeedEvent } from '../network/types';

export interface PlayerMatchStats {
  playerId: string;
  callsign: string;
  team: Team;
  kills: number;
  deaths: number;
  captures: number;
}

export interface KillFeedItem extends KillFeedEvent {
  createdAtMs: number;
}

export interface LocalDeathSummary {
  killerCallsign: string;
  killerTeam: Team;
  weaponType: WeaponType | 'hazard' | 'self';
  atMs: number;
}

const MAX_KILL_FEED = 4;
const KILL_FEED_TTL_MS = 4800;

const seenKillIds = new Set<string>();
const seenCaptureKeys = new Set<string>();
let feedPruneTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePrune(pruneFn: () => void) {
  if (feedPruneTimer !== null) {
    clearTimeout(feedPruneTimer);
  }
  feedPruneTimer = setTimeout(() => {
    feedPruneTimer = null;
    pruneFn();
  }, KILL_FEED_TTL_MS + 100);
}

interface MatchStatsStore {
  statsByPlayerId: Record<string, PlayerMatchStats>;
  killFeed: KillFeedItem[];
  localDeathSummary: LocalDeathSummary | null;
  tacticalMenuOpen: boolean;

  resetStats: () => void;
  setLocalDeathSummary: (summary: LocalDeathSummary | null) => void;
  setTacticalMenuOpen: (open: boolean) => void;
  registerParticipant: (playerId: string, callsign: string, team: Team) => void;
  recordKill: (evt: KillFeedEvent) => void;
  recordCapture: (playerId: string, callsign: string, team: Team, captureKey?: string) => void;
  pruneExpiredFeed: () => void;
}

export const useMatchStatsStore = create<MatchStatsStore>((set, get) => ({
  statsByPlayerId: {},
  killFeed: [],
  localDeathSummary: null,
  tacticalMenuOpen: false,

  resetStats: () => {
    seenKillIds.clear();
    seenCaptureKeys.clear();
    if (feedPruneTimer !== null) {
      clearTimeout(feedPruneTimer);
      feedPruneTimer = null;
    }
    set({
      statsByPlayerId: {},
      killFeed: [],
      localDeathSummary: null,
      tacticalMenuOpen: false,
    });
  },

  setLocalDeathSummary: (localDeathSummary) => set({ localDeathSummary }),

  setTacticalMenuOpen: (tacticalMenuOpen) => set({ tacticalMenuOpen }),

  registerParticipant: (playerId, callsign, team) =>
    set((state) => {
      const existing = state.statsByPlayerId[playerId];
      if (existing && existing.callsign === callsign && existing.team === team) {
        return state;
      }
      return {
        statsByPlayerId: {
          ...state.statsByPlayerId,
          [playerId]: existing
            ? { ...existing, callsign, team }
            : { playerId, callsign, team, kills: 0, deaths: 0, captures: 0 },
        },
      };
    }),

  recordKill: (evt) => {
    if (seenKillIds.has(evt.id)) return;
    seenKillIds.add(evt.id);
    if (seenKillIds.size > 64) {
      const first = seenKillIds.values().next().value;
      if (first !== undefined) seenKillIds.delete(first);
    }

    const nowMs = Date.now();
    set((state) => {
      const nextStats = { ...state.statsByPlayerId };

      const prevVictim = nextStats[evt.victimId] ?? {
        playerId: evt.victimId,
        callsign: evt.victimCallsign,
        team: evt.victimTeam,
        kills: 0,
        deaths: 0,
        captures: 0,
      };
      nextStats[evt.victimId] = {
        ...prevVictim,
        callsign: evt.victimCallsign,
        team: evt.victimTeam,
        deaths: prevVictim.deaths + 1,
      };

      const isValidKillerCredit =
        evt.killerId !== evt.victimId &&
        evt.weaponType !== 'hazard' &&
        evt.weaponType !== 'self' &&
        Boolean(evt.killerId);

      if (isValidKillerCredit) {
        const prevKiller = nextStats[evt.killerId] ?? {
          playerId: evt.killerId,
          callsign: evt.killerCallsign,
          team: evt.killerTeam,
          kills: 0,
          deaths: 0,
          captures: 0,
        };
        nextStats[evt.killerId] = {
          ...prevKiller,
          callsign: evt.killerCallsign,
          team: evt.killerTeam,
          kills: prevKiller.kills + 1,
        };
      }

      const item: KillFeedItem = { ...evt, createdAtMs: nowMs };
      const freshFeed = [
        ...state.killFeed.filter((k) => nowMs - k.createdAtMs < KILL_FEED_TTL_MS),
        item,
      ].slice(-MAX_KILL_FEED);

      return {
        statsByPlayerId: nextStats,
        killFeed: freshFeed,
      };
    });

    schedulePrune(() => get().pruneExpiredFeed());
  },

  recordCapture: (playerId, callsign, team, captureKey) => {
    if (captureKey) {
      if (seenCaptureKeys.has(captureKey)) return;
      seenCaptureKeys.add(captureKey);
      if (seenCaptureKeys.size > 32) {
        const first = seenCaptureKeys.values().next().value;
        if (first !== undefined) seenCaptureKeys.delete(first);
      }
    }

    set((state) => {
      const prev = state.statsByPlayerId[playerId] ?? {
        playerId,
        callsign,
        team,
        kills: 0,
        deaths: 0,
        captures: 0,
      };
      return {
        statsByPlayerId: {
          ...state.statsByPlayerId,
          [playerId]: {
            ...prev,
            callsign,
            team,
            captures: prev.captures + 1,
          },
        },
      };
    });
  },

  pruneExpiredFeed: () => {
    const nowMs = Date.now();
    set((state) => {
      const remaining = state.killFeed.filter((k) => nowMs - k.createdAtMs < KILL_FEED_TTL_MS);
      if (remaining.length === state.killFeed.length) return state;
      return { killFeed: remaining };
    });
    const remaining = get().killFeed;
    if (remaining.length > 0) {
      schedulePrune(() => get().pruneExpiredFeed());
    }
  },
}));

export function formatWeaponShortLabel(weapon: WeaponType | 'hazard' | 'self'): string {
  switch (weapon) {
    case 'rifle':
      return 'RIFLE';
    case 'shotgun':
      return 'SHOTGUN';
    case 'sniper':
      return 'SNIPER';
    case 'rocket':
      return 'RPG';
    case 'pistol':
      return 'PISTOL';
    case 'hazard':
      return 'HAZARD';
    case 'self':
      return 'BLAST';
  }
}
