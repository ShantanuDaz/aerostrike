import type { AvatarConfig } from '../../avatar/types';
import type { Team } from '../../ctf/types';
import type { GameMap } from '../../map/types';
import type { PeerInfo, RosterMember } from '../../network/types';

export function getCleanMapTitle(map: GameMap): string {
  return map.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function getMapModeTag(map: GameMap): string {
  if (map.id === 'ctf-canyon-arena') return 'LARGE CTF';
  if (map.id === 'sky-citadel') return 'AERIAL CTF';
  if (map.id === 'cryo-facility') return 'INDOOR CTF';
  if (map.id === 'training-ground') return 'SKIRMISH';
  if (map.id === 'bunker') return 'CQB';
  return map.width >= 2000 ? 'LARGE' : 'COMPACT';
}

export function formatClockPreset(sec: number): string {
  if (sec <= 0) return '∞';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface DerivedWarRoomSquad {
  localIsReady: boolean;
  memberList: RosterMember[];
  blueMembers: RosterMember[];
  redMembers: RosterMember[];
  totalPlayers: number;
  readyCount: number;
}

export interface DeriveWarRoomSquadInput {
  roster: Record<string, RosterMember>;
  peers: Record<string, PeerInfo>;
  localPlayerId: string;
  selfPeerId: string | null;
  localAvatar: AvatarConfig;
  localTeam: Team;
  localReadyFallback: boolean;
  isHost: boolean;
  gamePhase: 'staging' | 'in_game';
  defaultAvatar: AvatarConfig;
}

export function deriveWarRoomSquad({
  roster,
  peers,
  localPlayerId,
  selfPeerId,
  localAvatar,
  localTeam,
  localReadyFallback,
  isHost,
  gamePhase,
  defaultAvatar,
}: DeriveWarRoomSquadInput): DerivedWarRoomSquad {
  const localIsReady = roster[localPlayerId]?.isReady ?? localReadyFallback;
  const allMembersMap: Record<string, RosterMember> = {};

  for (const m of Object.values(roster)) {
    allMembersMap[m.playerId] = { ...m };
  }

  for (const p of Object.values(peers)) {
    // Match strictly by peerId so distinct pilots sharing a callsign are never collapsed
    const alreadyMapped = Object.values(allMembersMap).some((m) => m.peerId === p.peerId);
    if (!alreadyMapped) {
      allMembersMap[p.peerId] = {
        playerId: p.peerId,
        peerId: p.peerId,
        callsign: p.callsign,
        team: p.team,
        avatar: {
          ...defaultAvatar,
          callsign: p.callsign,
          bodyColor: p.team === 'blue' ? '#3b82f6' : '#ef4444',
        },
        isReady: p.isReady ?? true,
        isHost: Boolean(p.isHost),
        isOnline: true,
      };
    }
  }

  allMembersMap[localPlayerId] = {
    playerId: localPlayerId,
    peerId: selfPeerId || 'local',
    callsign: localAvatar.callsign,
    team: localTeam,
    avatar: localAvatar,
    isReady: localIsReady,
    isHost,
    isOnline: true,
  };

  const memberList = Object.values(allMembersMap).filter(
    (m) => m.isOnline || m.playerId === localPlayerId || gamePhase === 'in_game',
  );
  const blueMembers = memberList.filter((m) => m.team === 'blue');
  const redMembers = memberList.filter((m) => m.team === 'red');
  const totalPlayers = memberList.length;
  const readyCount = memberList.filter((m) => m.isReady).length;

  return {
    localIsReady,
    memberList,
    blueMembers,
    redMembers,
    totalPlayers,
    readyCount,
  };
}
