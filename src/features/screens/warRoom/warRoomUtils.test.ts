import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../avatar/avatarStore';
import { deriveWarRoomSquad, getMapModeTag } from './warRoomUtils';
import { holodeckMap } from '../../map/maps';

describe('deriveWarRoomSquad', () => {
  it('keeps distinct peers who share the same callsign and derives local ready status from roster', () => {
    const result = deriveWarRoomSquad({
      roster: {
        pilot_local: {
          playerId: 'pilot_local',
          peerId: 'peer-local',
          callsign: 'Pilot',
          team: 'blue',
          avatar: { ...DEFAULT_AVATAR, callsign: 'Pilot' },
          isReady: false,
          isHost: false,
          isOnline: true,
        },
      },
      peers: {
        'peer-duplicate-name': {
          peerId: 'peer-duplicate-name',
          callsign: 'Pilot',
          team: 'red',
          isReady: true,
          isHost: true,
          lastSeen: 1000,
        },
      },
      localPlayerId: 'pilot_local',
      selfPeerId: 'peer-local',
      localAvatar: { ...DEFAULT_AVATAR, callsign: 'Pilot' },
      localTeam: 'blue',
      localReadyFallback: true,
      isHost: false,
      gamePhase: 'staging',
      defaultAvatar: DEFAULT_AVATAR,
    });

    // Authoritative roster `isReady: false` must win over local fallback `true`
    expect(result.localIsReady).toBe(false);
    // Remote peer named 'Pilot' must NOT be hidden by callsign collision
    expect(result.totalPlayers).toBe(2);
    expect(result.blueMembers).toHaveLength(1);
    expect(result.redMembers).toHaveLength(1);
    expect(result.redMembers[0].peerId).toBe('peer-duplicate-name');
    expect(result.readyCount).toBe(1);
  });

  it('correctly maps 3D tactical mode tag for holodeckMap', () => {
    expect(getMapModeTag(holodeckMap)).toBe('3D TACTICAL');
  });
});
