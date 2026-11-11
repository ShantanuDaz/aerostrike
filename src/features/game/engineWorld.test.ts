import { describe, expect, it } from 'vitest';
import type { GameMap } from '../map/types';
import { buildActiveStations, engineWorld } from './engineWorld';

const STATION_MAP: GameMap = {
  id: 'station-test-map',
  name: 'Station Test',
  width: 1200,
  height: 800,
  backgroundColor: '#000',
  baseBlue: { x: 0, y: 600, width: 100, height: 100 },
  baseRed: { x: 1100, y: 600, width: 100, height: 100 },
  flagBlue: { x: 50, y: 650 },
  flagRed: { x: 1150, y: 650 },
  spawnPointsBlue: [{ x: 100, y: 650 }],
  spawnPointsRed: [{ x: 1100, y: 650 }],
  weaponSpawns: [],
  refillStations: [
    { id: 'st-med', x: 300, y: 600, stationType: 'medkit' },
    { id: 'st-fuel', x: 600, y: 600, stationType: 'fuel' },
    { id: 'st-supply', x: 900, y: 600, stationType: 'supply', cooldownSec: 20 },
  ],
  obstacles: [],
};

describe('engineWorld refill station cooldown lifecycle and host sync', () => {
  it('builds default cooldowns per station type and respects explicit overrides', () => {
    const stations = buildActiveStations(STATION_MAP);
    expect(stations).toHaveLength(3);
    expect(stations[0].cooldownSec).toBe(14);
    expect(stations[1].cooldownSec).toBe(10);
    expect(stations[2].cooldownSec).toBe(20);
    expect(stations.every((s) => s.respawnTimer === 0)).toBe(true);
  });

  it('marks stations taken, exports cooldowns, and restores pending cooldowns after reset', () => {
    const initial = buildActiveStations(STATION_MAP);
    engineWorld.resetWorldForMatch([], true, initial);

    expect(engineWorld.isStationAvailable('st-med')).toBe(true);
    engineWorld.markStationTaken('st-med');
    expect(engineWorld.isStationAvailable('st-med')).toBe(false);

    const exported = engineWorld.exportStationCooldowns();
    expect(exported).toHaveLength(1);
    expect(exported[0].id).toBe('st-med');
    expect(exported[0].remainingSec).toBe(14);

    // Late joiner applies cooldown snapshot before arena mounts station array
    engineWorld.stations = [];
    engineWorld.applyStationCooldowns([{ id: 'st-supply', remainingSec: 9.5 }]);
    engineWorld.resetWorldForMatch([], false, buildActiveStations(STATION_MAP));

    const supply = engineWorld.stations.find((s) => s.id === 'st-supply')!;
    expect(supply.respawnTimer).toBeGreaterThan(9);
    expect(supply.respawnTimer).toBeLessThanOrEqual(9.5);
  });
});
