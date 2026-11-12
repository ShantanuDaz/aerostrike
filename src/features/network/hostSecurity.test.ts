import { describe, expect, it } from 'vitest';
import type { AvatarConfig } from '../avatar/types';
import type { Flag } from '../ctf/types';
import type { RosterMember } from './types';
import {
  DamageRateTracker,
  sanitizeIncomingPeerMeta,
  validateFlagEvent,
  validateIncomingDamage,
  validateIncomingKillFeed,
  validateIncomingShoot,
} from './hostSecurity';

const BASE_AVATAR: AvatarConfig = {
  callsign: 'Cadet',
  bodyColor: '#dc2626',
  skinTone: '#fed7aa',
  headgear: 'soldier_helmet',
  headgearColor: '#1e293b',
  visorStyle: 'classic',
  visorColor: '#00f0ff',
  jetpackStyle: 'dual_tank',
};

const RED_CADET: RosterMember = {
  playerId: 'pilot_red',
  peerId: 'peer_red',
  slot: 1,
  callsign: 'Spectre',
  team: 'red',
  avatar: BASE_AVATAR,
  isReady: true,
  isHost: false,
  isOnline: true,
};

const BLUE_HOST: RosterMember = {
  playerId: 'pilot_host',
  peerId: 'host_peer',
  slot: 0,
  callsign: 'Commander',
  team: 'blue',
  avatar: { ...BASE_AVATAR, callsign: 'Commander', bodyColor: '#2563eb' },
  isReady: true,
  isHost: true,
  isOnline: true,
};

function makeFlags(): Record<'blue' | 'red', Flag> {
  return {
    blue: {
      team: 'blue',
      status: 'at_base',
      x: 200,
      y: 1000,
      baseX: 200,
      baseY: 1000,
      carrierId: null,
      returnTimer: 0,
    },
    red: {
      team: 'red',
      status: 'at_base',
      x: 2800,
      y: 1000,
      baseX: 2800,
      baseY: 1000,
      carrierId: null,
      returnTimer: 0,
    },
  };
}

describe('hostSecurity validation suite', () => {
  it('rejects damage packets without a valid weaponType or outside active combat', () => {
    const tracker = new DamageRateTracker();
    const baseCtx = {
      senderPeerId: 'peer_red',
      senderMember: RED_CADET,
      targetMember: BLUE_HOST,
      hostPlayerId: 'pilot_host',
      hostPeerId: 'host_peer',
      localPlayer: { id: 'pilot_host', isDead: false, invulnerableTimer: 0 },
      isInActiveBattle: true,
      gamePhase: 'in_game' as const,
      rateTracker: tracker,
      nowMs: 1000,
    };

    // Missing weaponType previously defaulted to maxSingleHit=100; must now reject
    expect(
      validateIncomingDamage({
        ...baseCtx,
        payload: {
          targetId: 'pilot_host',
          dealerId: 'pilot_red',
          damage: 90,
          knockbackX: 2,
          knockbackY: 0,
        },
      }),
    ).toBe(false);

    // Non-finite source coords rejected
    expect(
      validateIncomingDamage({
        ...baseCtx,
        payload: {
          targetId: 'pilot_host',
          dealerId: 'pilot_red',
          weaponType: 'rifle',
          damage: 14,
          knockbackX: 1,
          knockbackY: 0,
          sourceX: Number.NaN,
          sourceY: 100,
        },
      }),
    ).toBe(false);

    // Valid rifle hit succeeds when in_game and active
    expect(
      validateIncomingDamage({
        ...baseCtx,
        payload: {
          targetId: 'pilot_host',
          dealerId: 'pilot_red',
          weaponType: 'rifle',
          damage: 14,
          knockbackX: 1,
          knockbackY: 0,
          sourceX: 500,
          sourceY: 600,
        },
      }),
    ).toBe(true);

    // Rejected outside active battle
    expect(
      validateIncomingDamage({
        ...baseCtx,
        isInActiveBattle: false,
        payload: {
          targetId: 'pilot_host',
          dealerId: 'pilot_red',
          weaponType: 'rifle',
          damage: 14,
          knockbackX: 1,
          knockbackY: 0,
        },
      }),
    ).toBe(false);
  });

  it('enforces team rules, carrier ownership, and proximity on CTF flag actions', () => {
    const flags = makeFlags();

    // Red cadet tries to pick up their own red flag -> blocked
    expect(
      validateFlagEvent(
        { action: 'pickup', team: 'red', carrierId: 'pilot_host' },
        RED_CADET,
        { x: 2800, y: 1000, isDead: false },
        flags,
        true,
        'playing',
      ),
    ).toBeNull();

    // Red cadet far away from Blue flag tries pickup -> blocked
    expect(
      validateFlagEvent(
        { action: 'pickup', team: 'blue' },
        RED_CADET,
        { x: 2700, y: 1000, isDead: false },
        flags,
        true,
        'playing',
      ),
    ).toBeNull();

    // Dead red cadet cannot touch flag even right on top of it -> blocked
    expect(
      validateFlagEvent(
        { action: 'pickup', team: 'blue' },
        RED_CADET,
        { x: 205, y: 1000, isDead: true },
        flags,
        true,
        'playing',
      ),
    ).toBeNull();

    // Valid pickup overrides spoofed carrierId with canonical actorId
    const pickup = validateFlagEvent(
      { action: 'pickup', team: 'blue', carrierId: 'someone_else' },
      RED_CADET,
      { x: 220, y: 1000, isDead: false },
      flags,
      true,
      'playing',
    );
    expect(pickup).toEqual({
      action: 'pickup',
      team: 'blue',
      actorId: 'pilot_red',
      actorCallsign: 'Spectre',
    });

    // Capture allowed only when carrying enemy flag & at own base while own flag is home
    const carriedFlags = makeFlags();
    carriedFlags.blue.status = 'carried';
    carriedFlags.blue.carrierId = 'pilot_red';

    expect(
      validateFlagEvent(
        { action: 'capture', team: 'red' },
        RED_CADET,
        { x: 2780, y: 1000, isDead: false },
        carriedFlags,
        true,
        'playing',
      ),
    ).toEqual({
      action: 'capture',
      team: 'red',
      actorId: 'pilot_red',
      actorCallsign: 'Spectre',
    });

    // Capture blocked during game_over
    expect(
      validateFlagEvent(
        { action: 'capture', team: 'red' },
        RED_CADET,
        { x: 2780, y: 1000, isDead: false },
        carriedFlags,
        true,
        'game_over',
      ),
    ).toBeNull();
  });

  it('strips isHost spoofing on peer_meta and validates shoot / kill_feed ownership', () => {
    const onHost = sanitizeIncomingPeerMeta(
      { callsign: '  RogueLeader  ', team: 'red', isReady: false, isHost: true },
      true,
    );
    expect(onHost).toEqual({ callsign: 'RogueLeader', team: 'red', isReady: false });
    expect(onHost.isHost).toBeUndefined();

    // Shoot rejects spoofed shooterId & invalid spreadOffsets
    expect(
      validateIncomingShoot(
        {
          shooterId: 'pilot_host',
          team: 'blue',
          weaponType: 'shotgun',
          originX: 100,
          originY: 200,
          aimAngle: 0,
        },
        'peer_red',
        RED_CADET,
        true,
        'in_game',
      ),
    ).toBeNull();

    const validShot = validateIncomingShoot(
      {
        shooterId: 'pilot_red',
        team: 'blue', // Host canonicalizes to member's actual team
        weaponType: 'shotgun',
        originX: 100,
        originY: 200,
        aimAngle: 0.2,
        spreadOffsets: [-0.1, -0.05, 0, 0.05, 0.1, 0.12],
      },
      'peer_red',
      RED_CADET,
      true,
      'in_game',
    );
    expect(validShot?.team).toBe('red');
    expect(validShot?.shooterId).toBe('pilot_red');

    // KillFeed rejects fabricated kills involving unrelated third parties
    expect(
      validateIncomingKillFeed(
        {
          id: 'fake_k1',
          killerId: 'pilot_other_a',
          killerCallsign: 'A',
          killerTeam: 'blue',
          victimId: 'pilot_other_b',
          victimCallsign: 'B',
          victimTeam: 'red',
          weaponType: 'rifle',
        },
        'peer_red',
        RED_CADET,
        true,
        'in_game',
      ),
    ).toBeNull();
  });
});
