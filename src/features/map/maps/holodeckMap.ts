import type { GameMap } from '../types';

export const holodeckMap: GameMap = {
  id: 'holodeck-alpha',
  name: 'Holodeck Alpha (3D FPS)',
  width: 2400,
  height: 1400,
  backgroundColor: '#060913',
  theme: 'training_deck',

  baseBlue: {
    x: 100,
    y: 800,
    width: 280,
    height: 300,
  },

  baseRed: {
    x: 2020,
    y: 800,
    width: 280,
    height: 300,
  },

  flagBlue: {
    x: 240,
    y: 950,
  },

  flagRed: {
    x: 2160,
    y: 950,
  },

  spawnPointsBlue: [
    { x: 200, y: 950 },
    { x: 280, y: 950 },
  ],

  spawnPointsRed: [
    { x: 2120, y: 950 },
    { x: 2200, y: 950 },
  ],

  weaponSpawns: [],
  bouncePads: [],
  refillStations: [],
  obstacles: [
    { id: 'holodeck-ground', x: 0, y: 1300, width: 2400, height: 100, type: 'ground' },
    { id: 'holodeck-roof', x: 0, y: 0, width: 2400, height: 80, type: 'ground' },
    { id: 'holodeck-left-wall', x: 0, y: 0, width: 60, height: 1400, type: 'wall' },
    { id: 'holodeck-right-wall', x: 2340, y: 0, width: 60, height: 1400, type: 'wall' },
  ],
};
