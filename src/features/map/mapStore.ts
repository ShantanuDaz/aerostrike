import { create } from 'zustand';
import { availableMaps, ctfArenaMap } from './maps';
import type { GameMap } from './types';

interface MapState {
  selectedMap: GameMap;
  availableMaps: Record<string, GameMap>;
  selectMap: (mapId: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedMap: ctfArenaMap,
  availableMaps,
  selectMap: (mapId: string) =>
    set((state) => ({
      selectedMap: state.availableMaps[mapId] ?? state.selectedMap,
    })),
}));
