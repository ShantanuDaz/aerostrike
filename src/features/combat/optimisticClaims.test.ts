import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOptimisticClaims,
  handleAuthoritativePickupTaken,
  handleAuthoritativeStationTaken,
  recordOptimisticPickupClaim,
  recordOptimisticStationClaim,
} from './optimisticClaims';
import { useCombatStore } from './combatStore';
import { usePlayerStore } from '../player/playerStore';
import { engineWorld } from '../game/engineWorld';

describe('optimistic pickup & station conflict rollback', () => {
  beforeEach(() => {
    clearOptimisticClaims();
    useCombatStore.getState().initLoadout('rifle');
    usePlayerStore.getState().resetPlayer();
  });

  it('rolls back an optimistic weapon pickup grant when Host awards it to another player', () => {
    const before = useCombatStore.getState();
    recordOptimisticPickupClaim('wp_rocket_1', 'rocket', before.equippedWeapon, before.ammoByWeapon.rocket, 1000);
    useCombatStore.getState().grantWeaponPickup('rocket');

    expect(useCombatStore.getState().equippedWeapon).toBe('rocket');
    expect(useCombatStore.getState().ammoByWeapon.rocket).toBe(3);

    // Another pilot won the race on Host
    handleAuthoritativePickupTaken('wp_rocket_1', 'pilot_rival', 'pilot_local', 1050);

    expect(useCombatStore.getState().ammoByWeapon.rocket).toBe(0);
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');
  });

  it('rolls back an optimistic medkit heal when another pilot won the station claim', () => {
    const p = usePlayerStore.getState().player;
    usePlayerStore.getState().setPlayer({ ...p, health: 40, boostFuel: 30 });

    recordOptimisticStationClaim('st_med_1', 'medkit', 55, 30, false, 0, 2000);
    const updated = { ...engineWorld.localPlayer!, health: 95 };
    usePlayerStore.getState().setPlayer(updated);

    handleAuthoritativeStationTaken('st_med_1', 'pilot_rival', updated.id, 2040);

    expect(usePlayerStore.getState().player.health).toBe(40);
  });
});
