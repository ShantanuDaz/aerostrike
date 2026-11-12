import { create } from 'zustand';

export type MicPermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface VoiceState {
  micEnabled: boolean;
  micPermission: MicPermissionState;
  micError: string | null;
  isLocalSpeaking: boolean;
  autoplayBlocked: boolean;
  remoteMicByPlayerId: Record<string, boolean>;
  remoteSpeakingByPlayerId: Record<string, boolean>;
  mutedPlayerIds: Record<string, boolean>;

  setMicEnabled: (enabled: boolean) => void;
  setMicPermission: (permission: MicPermissionState, error?: string | null) => void;
  setLocalSpeaking: (speaking: boolean) => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  setRemoteMicState: (playerId: string, enabled: boolean) => void;
  setRemoteSpeaking: (playerId: string, speaking: boolean) => void;
  toggleMuteRemotePlayer: (playerId: string) => void;
  removeRemoteVoice: (playerId: string) => void;
  resetVoiceState: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  micEnabled: false,
  micPermission: 'idle',
  micError: null,
  isLocalSpeaking: false,
  autoplayBlocked: false,
  remoteMicByPlayerId: {},
  remoteSpeakingByPlayerId: {},
  mutedPlayerIds: {},

  setMicEnabled: (micEnabled) => set({ micEnabled }),

  setMicPermission: (micPermission, micError = null) => set({ micPermission, micError }),

  setLocalSpeaking: (isLocalSpeaking) =>
    set((state) => (state.isLocalSpeaking === isLocalSpeaking ? state : { isLocalSpeaking })),

  setAutoplayBlocked: (autoplayBlocked) =>
    set((state) => (state.autoplayBlocked === autoplayBlocked ? state : { autoplayBlocked })),

  setRemoteMicState: (playerId, enabled) =>
    set((state) => ({
      remoteMicByPlayerId: {
        ...state.remoteMicByPlayerId,
        [playerId]: enabled,
      },
      remoteSpeakingByPlayerId: enabled
        ? state.remoteSpeakingByPlayerId
        : { ...state.remoteSpeakingByPlayerId, [playerId]: false },
    })),

  setRemoteSpeaking: (playerId, speaking) =>
    set((state) => {
      if (Boolean(state.remoteSpeakingByPlayerId[playerId]) === speaking) {
        return state;
      }
      return {
        remoteSpeakingByPlayerId: {
          ...state.remoteSpeakingByPlayerId,
          [playerId]: speaking,
        },
      };
    }),

  toggleMuteRemotePlayer: (playerId) =>
    set((state) => ({
      mutedPlayerIds: {
        ...state.mutedPlayerIds,
        [playerId]: !state.mutedPlayerIds[playerId],
      },
    })),

  removeRemoteVoice: (playerId) =>
    set((state) => {
      if (
        !(playerId in state.remoteMicByPlayerId) &&
        !(playerId in state.remoteSpeakingByPlayerId)
      ) {
        return state;
      }
      const nextMic = { ...state.remoteMicByPlayerId };
      const nextSpeaking = { ...state.remoteSpeakingByPlayerId };
      delete nextMic[playerId];
      delete nextSpeaking[playerId];
      return {
        remoteMicByPlayerId: nextMic,
        remoteSpeakingByPlayerId: nextSpeaking,
      };
    }),

  resetVoiceState: () =>
    set({
      micEnabled: false,
      micError: null,
      isLocalSpeaking: false,
      autoplayBlocked: false,
      remoteMicByPlayerId: {},
      remoteSpeakingByPlayerId: {},
      mutedPlayerIds: {},
    }),
}));
