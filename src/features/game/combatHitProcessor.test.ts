import { describe, expect, it } from 'vitest';
import { HAZARD_ASSIST_WINDOW_MS, resolveHazardKillAttribution } from './combatHitProcessor';

describe('resolveHazardKillAttribution', () => {
  it('credits a recent enemy attacker when victim falls into a hazard within the assist window', () => {
    const evt = resolveHazardKillAttribution({
      victimId: 'bot_red_spectre',
      victimCallsign: 'SPECTRE-AI',
      victimTeam: 'red',
      localPlayer: { id: 'local_1', team: 'blue', callsign: 'ACE' },
      localPlayerId: 'local_1',
      recentAttacker: {
        dealerId: 'local_1',
        weaponType: 'rocket',
        atMs: 10000,
      },
      isMultiplayer: false,
      nowMs: 12500,
    });

    expect(evt.killerId).toBe('local_1');
    expect(evt.killerCallsign).toBe('ACE');
    expect(evt.killerTeam).toBe('blue');
    expect(evt.weaponType).toBe('rocket');
  });

  it('falls back to ARENA hazard credit once the assist window expires or without attacker', () => {
    const expired = resolveHazardKillAttribution({
      victimId: 'bot_red_spectre',
      victimCallsign: 'SPECTRE-AI',
      victimTeam: 'red',
      localPlayer: { id: 'local_1', team: 'blue', callsign: 'ACE' },
      localPlayerId: 'local_1',
      recentAttacker: {
        dealerId: 'local_1',
        weaponType: 'rifle',
        atMs: 1000,
      },
      isMultiplayer: false,
      nowMs: 1000 + HAZARD_ASSIST_WINDOW_MS + 100,
    });

    expect(expired.killerId).toBe('hazard');
    expect(expired.killerCallsign).toBe('ARENA');
    expect(expired.weaponType).toBe('hazard');
  });

  it('credits opposing remote player in multiplayer hazard kills while ignoring friendly attackers', () => {
    const enemyCredit = resolveHazardKillAttribution({
      victimId: 'local_1',
      victimCallsign: 'ACE',
      victimTeam: 'blue',
      localPlayer: { id: 'local_1', team: 'blue', callsign: 'ACE' },
      localPlayerId: 'local_1',
      recentAttacker: {
        dealerId: 'rival_1',
        weaponType: 'shotgun',
        atMs: 5000,
      },
      getRemote: (id) =>
        id === 'rival_1' ? { id: 'rival_1', team: 'red', callsign: 'VEX' } : undefined,
      isMultiplayer: true,
      nowMs: 7000,
    });

    expect(enemyCredit.killerId).toBe('rival_1');
    expect(enemyCredit.killerCallsign).toBe('VEX');
    expect(enemyCredit.weaponType).toBe('shotgun');

    const selfCreditIgnored = resolveHazardKillAttribution({
      victimId: 'local_1',
      victimCallsign: 'ACE',
      victimTeam: 'blue',
      localPlayer: { id: 'local_1', team: 'blue', callsign: 'ACE' },
      localPlayerId: 'local_1',
      recentAttacker: {
        dealerId: 'local_1',
        weaponType: 'rocket',
        atMs: 5000,
      },
      isMultiplayer: true,
      nowMs: 5200,
    });
    expect(selfCreditIgnored.killerId).toBe('hazard');
  });

  it('credits same-team hazard assists in FFA when allowFriendlyFire is true', () => {
    const ffaEvt = resolveHazardKillAttribution({
      victimId: 'bot_blue_2',
      victimCallsign: 'VIPER-AI',
      victimTeam: 'blue',
      localPlayer: { id: 'local_1', team: 'blue', callsign: 'ACE' },
      localPlayerId: 'local_1',
      recentAttacker: {
        dealerId: 'local_1',
        weaponType: 'grenade',
        atMs: 5000,
      },
      isMultiplayer: false,
      allowFriendlyFire: true,
      nowMs: 6500,
    });

    expect(ffaEvt.killerId).toBe('local_1');
    expect(ffaEvt.killerCallsign).toBe('ACE');
    expect(ffaEvt.weaponType).toBe('grenade');
  });
});
