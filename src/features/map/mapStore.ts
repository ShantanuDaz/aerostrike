import { create } from 'zustand';
import { availableMaps, ctfArenaMap } from './maps';
import type { GameMap } from './types';

export const MAP_ROTATION_ORDER: string[] = [
  'ctf-canyon-arena',
  'helios-caldera',
  'bunker',
  'sky-citadel',
  'cryo-facility',
  'training-ground',
];

interface MapState {
  selectedMap: GameMap;
  availableMaps: Record<string, GameMap>;
  autoRotate: boolean;
  selectMap: (mapId: string) => void;
  setAutoRotate: (enabled: boolean) => void;
  rotateToNextMap: () => GameMap;
  randomizeMap: () => GameMap;
}

export const useMapStore = create<MapState>((set, get) => ({
  selectedMap: ctfArenaMap,
  availableMaps,
  autoRotate: false,
  selectMap: (mapId: string) =>
    set((state) => ({
      selectedMap: state.availableMaps[mapId] ?? state.selectedMap,
    })),
  setAutoRotate: (enabled: boolean) => set({ autoRotate: enabled }),
  rotateToNextMap: () => {
    const state = get();
    const currentId = state.selectedMap.id;
    const currentIdx = MAP_ROTATION_ORDER.indexOf(currentId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % MAP_ROTATION_ORDER.length : 0;
    const nextMapId = MAP_ROTATION_ORDER[nextIdx];
    const nextMap = state.availableMaps[nextMapId] ?? state.selectedMap;
    set({ selectedMap: nextMap });
    return nextMap;
  },
  randomizeMap: () => {
    const state = get();
    const currentId = state.selectedMap.id;
    const candidates = MAP_ROTATION_ORDER.filter((id) => id !== currentId && state.availableMaps[id]);
    const chosenId = candidates[Math.floor(Math.random() * candidates.length)] ?? currentId;
    const chosenMap = state.availableMaps[chosenId] ?? state.selectedMap;
    set({ selectedMap: chosenMap });
    return chosenMap;
  },
}));
