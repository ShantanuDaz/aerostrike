import { create } from 'zustand';
import type { PeerInfo, RosterMember } from './types';
import { engineWorld } from '../game/engineWorld';

function allocateSlot(roster: Record<string, RosterMember>, isHost: boolean): number {
  const used = new Set<number>();
  for (const m of Object.values(roster)) {
    if (typeof m.slot === 'number') used.add(m.slot);
  }
  if (isHost && !used.has(0)) return 0;
  for (let s = isHost ? 0 : 1; s < 255; s++) {
    if (!used.has(s)) return s;
  }
  return 254;
}

interface NetworkState {
  roomCode: string | null;
  isConnected: boolean;
  selfPeerId: string | null;
  isHost: boolean;
  isRoomCreator: boolean;
  hostPeerId: string | null;
  peers: Record<string, PeerInfo>;

  // Host Authority Roster & Game Phase
  gamePhase: 'staging' | 'in_game';
  currentMapId: string;
  roster: Record<string, RosterMember>;
  isJoinRejected: boolean;
  rejectionReason: string | null;
  isAuthApproved: boolean;
  hostSignalLost: boolean;
  hostDisconnectReason: string | null;
  hostReconnectAttempts: number;

  setRoomCode: (roomCode: string | null) => void;
  setConnected: (isConnected: boolean, selfPeerId: string | null, isCreator?: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setIsRoomCreator: (isRoomCreator: boolean) => void;
  setHostPeerId: (hostPeerId: string | null) => void;
  setGamePhase: (phase: 'staging' | 'in_game') => void;
  setCurrentMapId: (mapId: string) => void;
  setRoster: (roster: Record<string, RosterMember> | RosterMember[]) => void;
  upsertRosterMember: (member: RosterMember) => void;
  updateRosterMember: (idOrCallsign: string, patch: Partial<RosterMember>) => void;
  setJoinRejected: (rejected: boolean, reason?: string | null) => void;
  setIsAuthApproved: (isAuthApproved: boolean) => void;
  setHostSignalLost: (lost: boolean, reason?: string | null) => void;
  incrementHostReconnectAttempt: () => void;
  resetHostSignal: () => void;
  addPeer: (peerId: string, info: Partial<PeerInfo>) => void;
  updatePeer: (peerId: string, patch: Partial<PeerInfo>) => void;
  removePeer: (peerId: string) => void;
  removeRemotePlayer: (id: string) => void;
  clearRemotePlayers: () => void;
  clearNetwork: () => void;
  recalculateHost: () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  roomCode: null,
  isConnected: false,
  selfPeerId: null,
  isHost: false,
  isRoomCreator: false,
  hostPeerId: null,
  peers: {},

  gamePhase: 'staging',
  currentMapId: 'ctf-canyon-arena',
  roster: {},
  isJoinRejected: false,
  rejectionReason: null,
  isAuthApproved: false,
  hostSignalLost: false,
  hostDisconnectReason: null,
  hostReconnectAttempts: 0,

  setRoomCode: (roomCode) => set({ roomCode }),

  setConnected: (isConnected, selfPeerId, isCreator) => {
    if (isCreator !== undefined) {
      set({
        isConnected,
        selfPeerId,
        isRoomCreator: isCreator,
        isHost: isCreator,
        isAuthApproved: isCreator,
        ...(isCreator
          ? { hostSignalLost: false, hostDisconnectReason: null, hostReconnectAttempts: 0 }
          : {}),
      });
    } else {
      set({ isConnected, selfPeerId });
    }
    get().recalculateHost();
  },

  setIsHost: (isHost) => set({ isHost }),
  setIsRoomCreator: (isRoomCreator) =>
    set({ isRoomCreator, isHost: isRoomCreator, isAuthApproved: isRoomCreator }),
  setHostPeerId: (hostPeerId) => set({ hostPeerId }),
  setGamePhase: (gamePhase) => set({ gamePhase }),
  setCurrentMapId: (currentMapId) => set({ currentMapId }),
  setIsAuthApproved: (isAuthApproved) => set({ isAuthApproved }),
  setHostSignalLost: (hostSignalLost, reason = null) =>
    set((state) => ({
      hostSignalLost,
      hostDisconnectReason: hostSignalLost
        ? reason ?? state.hostDisconnectReason ?? 'Connection to room host interrupted.'
        : null,
      hostReconnectAttempts: hostSignalLost ? state.hostReconnectAttempts : 0,
    })),
  incrementHostReconnectAttempt: () =>
    set((state) => ({ hostReconnectAttempts: state.hostReconnectAttempts + 1 })),
  resetHostSignal: () =>
    set({
      hostSignalLost: false,
      hostDisconnectReason: null,
      hostReconnectAttempts: 0,
    }),

  setRoster: (rosterInput) => {
    const rawList = Array.isArray(rosterInput)
      ? rosterInput
      : Object.values(rosterInput);

    const rosterMap: Record<string, RosterMember> = {};
    for (const m of rawList) {
      const assignedSlot =
        typeof m.slot === 'number'
          ? m.slot
          : allocateSlot(rosterMap, m.isHost);
      const normalized: RosterMember = { ...m, slot: assignedSlot };
      rosterMap[m.playerId] = normalized;
      engineWorld.syncRemoteMetadata(
        normalized.playerId,
        normalized.team,
        normalized.avatar,
        assignedSlot,
      );
    }
    set({ roster: rosterMap });
  },

  upsertRosterMember: (member) =>
    set((state) => {
      const roster = { ...state.roster };
      let preservedSlot = roster[member.playerId]?.slot ?? member.slot;

      Object.keys(roster).forEach((id) => {
        if (
          id !== member.playerId &&
          member.peerId !== 'pending' &&
          roster[id].peerId === member.peerId
        ) {
          if (preservedSlot === undefined) {
            preservedSlot = roster[id].slot;
          }
          delete roster[id];
        }
      });

      const slot =
        typeof preservedSlot === 'number'
          ? preservedSlot
          : allocateSlot(roster, member.isHost);

      const finalMember: RosterMember = { ...member, slot };
      roster[member.playerId] = finalMember;

      engineWorld.syncRemoteMetadata(
        finalMember.playerId,
        finalMember.team,
        finalMember.avatar,
        slot,
      );

      return { roster };
    }),

  updateRosterMember: (idOrCallsign, patch) =>
    set((state) => {
      const roster = { ...state.roster };
      const keys = Object.keys(roster);
      const targetId = roster[idOrCallsign]
        ? idOrCallsign
        : keys.find((key) => roster[key].peerId === idOrCallsign) ??
          keys.find((key) => roster[key].callsign === idOrCallsign);
      if (targetId && roster[targetId]) {
        const updated = { ...roster[targetId], ...patch };
        roster[targetId] = updated;
        engineWorld.syncRemoteMetadata(
          updated.playerId,
          updated.team,
          updated.avatar,
          updated.slot,
        );
        return { roster };
      }
      return state;
    }),

  setJoinRejected: (isJoinRejected, rejectionReason = null) =>
    set({ isJoinRejected, rejectionReason }),

  addPeer: (peerId, info) => {
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          peerId,
          callsign: info.callsign || 'Soldier_' + peerId.slice(0, 4),
          team: info.team || (Object.keys(state.peers).length % 2 === 0 ? 'red' : 'blue'),
          isReady: info.isReady ?? true,
          isHost: info.isHost ?? false,
          lastSeen: Date.now(),
        },
      },
      hostPeerId: info.isHost ? peerId : state.hostPeerId,
    }));
    get().recalculateHost();
  },

  updatePeer: (peerId, patch) => {
    set((state) => {
      const existing = state.peers[peerId];
      if (!existing) return state;
      const isPeerHost = patch.isHost !== undefined ? patch.isHost : existing.isHost;
      return {
        peers: {
          ...state.peers,
          [peerId]: { ...existing, ...patch, lastSeen: Date.now() },
        },
        hostPeerId: isPeerHost ? peerId : state.hostPeerId,
      };
    });
    get().recalculateHost();
  },

  removePeer: (peerId) => {
    set((state) => {
      const nextPeers = { ...state.peers };
      delete nextPeers[peerId];
      engineWorld.removeRemotePlayer(peerId);
      Object.values(state.roster).forEach((member) => {
        if (member.peerId === peerId) {
          engineWorld.removeRemotePlayer(member.playerId);
        }
      });
      const nextHostPeerId = state.hostPeerId === peerId ? null : state.hostPeerId;
      return { peers: nextPeers, hostPeerId: nextHostPeerId };
    });
    get().recalculateHost();
  },

  removeRemotePlayer: (id) => {
    engineWorld.removeRemotePlayer(id);
  },

  clearRemotePlayers: () => {
    engineWorld.clearRemotePlayers();
  },

  clearNetwork: () => {
    engineWorld.clearRemotePlayers();
    set({
      roomCode: null,
      isConnected: false,
      selfPeerId: null,
      isHost: false,
      isRoomCreator: false,
      hostPeerId: null,
      peers: {},
      gamePhase: 'staging',
      currentMapId: 'ctf-canyon-arena',
      roster: {},
      isJoinRejected: false,
      rejectionReason: null,
      isAuthApproved: false,
      hostSignalLost: false,
      hostDisconnectReason: null,
      hostReconnectAttempts: 0,
    });
  },

  recalculateHost: () => {
    const { selfPeerId, isRoomCreator, hostPeerId, peers } = get();

    if (isRoomCreator) {
      set({ isHost: true, hostPeerId: selfPeerId });
      return;
    }

    if (hostPeerId && peers[hostPeerId]) {
      set({ isHost: false });
      return;
    }

    const hostPeer = Object.values(peers).find((p) => p.isHost);
    if (hostPeer) {
      set({ isHost: false, hostPeerId: hostPeer.peerId });
      return;
    }

    set({ isHost: false });
  },
}));
