import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore, MAP_ROTATION_ORDER } from './mapStore';
import { availableMaps, ctfArenaMap } from './maps';

describe('useMapStore and MAP_ROTATION_ORDER integrity', () => {
  beforeEach(() => {
    useMapStore.setState({
      selectedMap: ctfArenaMap,
      availableMaps,
      autoRotate: false,
    });
  });

  it('ensures every ID in MAP_ROTATION_ORDER exists in availableMaps', () => {
    expect(MAP_ROTATION_ORDER.length).toBe(Object.keys(availableMaps).length);
    for (const mapId of MAP_ROTATION_ORDER) {
      expect(availableMaps[mapId], `Missing map for ID "${mapId}" in availableMaps`).toBeDefined();
      expect(availableMaps[mapId].id).toBe(mapId);
    }
  });

  it('cycles sequentially through all 6 maps with rotateToNextMap', () => {
    const store = useMapStore.getState();

    // Start from first map
    useMapStore.getState().selectMap(MAP_ROTATION_ORDER[0]);
    expect(useMapStore.getState().selectedMap.id).toBe(MAP_ROTATION_ORDER[0]);

    for (let i = 1; i < MAP_ROTATION_ORDER.length; i++) {
      const nextMap = store.rotateToNextMap();
      expect(nextMap.id).toBe(MAP_ROTATION_ORDER[i]);
      expect(useMapStore.getState().selectedMap.id).toBe(MAP_ROTATION_ORDER[i]);
    }

    // After last map, it must loop back to index 0
    const loopedMap = store.rotateToNextMap();
    expect(loopedMap.id).toBe(MAP_ROTATION_ORDER[0]);
    expect(useMapStore.getState().selectedMap.id).toBe(MAP_ROTATION_ORDER[0]);
  });

  it('randomizeMap selects a valid alternate arena without throwing', () => {
    const store = useMapStore.getState();
    const currentId = store.selectedMap.id;

    const randomMap = store.randomizeMap();
    expect(availableMaps[randomMap.id]).toBeDefined();
    expect(randomMap.id).not.toBe(currentId);
  });

  it('safely handles unknown map ID in selectMap', () => {
    const store = useMapStore.getState();
    const initialMap = store.selectedMap;

    store.selectMap('non-existent-map-xyz');
    expect(useMapStore.getState().selectedMap.id).toBe(initialMap.id);
  });
});
