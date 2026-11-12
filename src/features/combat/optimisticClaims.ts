import type { WeaponType } from '../combat/types';
import type { RefillStationType } from '../map/types';
import { useCombatStore } from './combatStore';
import { WEAPONS } from './weaponsConfig';
import { usePlayerStore } from '../player/playerStore';
import { engineWorld } from '../game/engineWorld';

const CLAIM_WINDOW_MS = 1800;

interface PendingPickupClaim {
  claimedAtMs: number;
  weaponType: WeaponType;
  prevAmmo: number;
  prevEquipped: WeaponType;
}

interface PendingStationClaim {
  claimedAtMs: number;
  stationType: RefillStationType;
  healthGained: number;
  prevBoostFuel: number;
  prevOverheated: boolean;
  prevDashCooldown: number;
}

const pendingPickupClaims = new Map<string, PendingPickupClaim>();
const pendingStationClaims = new Map<string, PendingStationClaim>();

export function clearOptimisticClaims() {
  pendingPickupClaims.clear();
  pendingStationClaims.clear();
}

export function recordOptimisticPickupClaim(
  pickupId: string,
  weaponType: WeaponType,
  prevEquipped: WeaponType,
  prevAmmo: number,
  nowMs: number = performance.now(),
) {
  pendingPickupClaims.set(pickupId, {
    claimedAtMs: nowMs,
    weaponType,
    prevAmmo,
    prevEquipped,
  });
}

export function handleAuthoritativePickupTaken(
  pickupId: string,
  claimantPlayerId: string,
  localPlayerId: string,
  nowMs: number = performance.now(),
) {
  const pending = pendingPickupClaims.get(pickupId);
  if (!pending) return;
  pendingPickupClaims.delete(pickupId);

  if (claimantPlayerId === localPlayerId || nowMs - pending.claimedAtMs > CLAIM_WINDOW_MS) {
    return;
  }

  const combat = useCombatStore.getState();
  const grantedAmmo = WEAPONS[pending.weaponType].maxAmmo;
  if (grantedAmmo === Infinity) return;

  const addedAmmo = Math.max(0, grantedAmmo - pending.prevAmmo);
  const currentForWeapon = combat.ammoByWeapon[pending.weaponType] ?? 0;
  const revertedAmmo = Math.max(0, currentForWeapon - addedAmmo);

  const nextAmmoByWeapon = {
    ...combat.ammoByWeapon,
    [pending.weaponType]: revertedAmmo,
  };

  let nextEquipped = combat.equippedWeapon;
  if (nextEquipped === pending.weaponType && revertedAmmo <= 0) {
    if (
      pending.prevEquipped !== pending.weaponType &&
      (WEAPONS[pending.prevEquipped].maxAmmo === Infinity || nextAmmoByWeapon[pending.prevEquipped] > 0)
    ) {
      nextEquipped = pending.prevEquipped;
    } else {
      nextEquipped = nextAmmoByWeapon.rifle > 0 ? 'rifle' : 'pistol';
    }
  }

  useCombatStore.setState({
    equippedWeapon: nextEquipped,
    ammoByWeapon: nextAmmoByWeapon,
    currentAmmo: nextAmmoByWeapon[nextEquipped] ?? 0,
  });
  engineWorld.notifyUrgentLocalStateChange();
}

export function recordOptimisticStationClaim(
  stationId: string,
  stationType: RefillStationType,
  healthGained: number,
  prevBoostFuel: number,
  prevOverheated: boolean,
  prevDashCooldown: number,
  nowMs: number = performance.now(),
) {
  pendingStationClaims.set(stationId, {
    claimedAtMs: nowMs,
    stationType,
    healthGained,
    prevBoostFuel,
    prevOverheated,
    prevDashCooldown,
  });
}

export function handleAuthoritativeStationTaken(
  stationId: string,
  claimantPlayerId: string,
  localPlayerId: string,
  nowMs: number = performance.now(),
) {
  const pending = pendingStationClaims.get(stationId);
  if (!pending) return;
  pendingStationClaims.delete(stationId);

  if (claimantPlayerId === localPlayerId || nowMs - pending.claimedAtMs > CLAIM_WINDOW_MS) {
    return;
  }

  const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
  if (localPlayer.isDead) return;

  const nextPlayer = { ...localPlayer };
  if ((pending.stationType === 'medkit' || pending.stationType === 'supply') && pending.healthGained > 0) {
    nextPlayer.health = Math.max(1, nextPlayer.health - pending.healthGained);
  }
  if (pending.stationType === 'fuel' || pending.stationType === 'supply') {
    nextPlayer.boostFuel = Math.min(nextPlayer.boostFuel, pending.prevBoostFuel);
    nextPlayer.fuelOverheated = pending.prevOverheated;
    nextPlayer.dashCooldown = Math.max(nextPlayer.dashCooldown ?? 0, pending.prevDashCooldown);
  }

  usePlayerStore.getState().setPlayer(nextPlayer);
  engineWorld.notifyUrgentLocalStateChange();
}
