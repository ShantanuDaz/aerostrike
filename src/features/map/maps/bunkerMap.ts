import type { GameMap } from '../types';

export const bunkerMap: GameMap = {
  id: 'bunker',
  name: 'Underground Vault (CTF 2200x1300)',
  width: 2200,
  height: 1300,
  backgroundColor: '#14181d',
  theme: 'bunker_vault',

  baseBlue: {
    x: 80,
    y: 860,
    width: 260,
    height: 260,
  },

  baseRed: {
    x: 1860,
    y: 860,
    width: 260,
    height: 260,
  },

  flagBlue: {
    x: 210,
    y: 1010,
  },

  flagRed: {
    x: 1990,
    y: 1010,
  },

  spawnPointsBlue: [
    { x: 140, y: 1010 },
    { x: 270, y: 1010 },
    { x: 190, y: 740 },
  ],

  spawnPointsRed: [
    { x: 2060, y: 1010 },
    { x: 1930, y: 1010 },
    { x: 2010, y: 740 },
  ],

  weaponSpawns: [
    { id: 'bunk-mid-rocket', x: 1100, y: 680, weaponType: 'rocket' },
    { id: 'bunk-low-shotgun-l', x: 680, y: 1110, weaponType: 'shotgun' },
    { id: 'bunk-low-shotgun-r', x: 1520, y: 1110, weaponType: 'shotgun' },
    { id: 'bunk-mid-rifle-l', x: 480, y: 660, weaponType: 'rifle' },
    { id: 'bunk-mid-rifle-r', x: 1720, y: 660, weaponType: 'rifle' },
    { id: 'bunk-top-sniper-l', x: 780, y: 320, weaponType: 'sniper' },
    { id: 'bunk-top-sniper-r', x: 1420, y: 320, weaponType: 'sniper' },
  ],

  bouncePads: [
    { id: 'bunk-pad-l', x: 420, y: 1188, width: 56, height: 12, launchVy: -13.5, color: '#22d3ee' },
    { id: 'bunk-pad-r', x: 1724, y: 1188, width: 56, height: 12, launchVy: -13.5, color: '#22d3ee' },
    { id: 'bunk-pad-core-l', x: 820, y: 1188, width: 54, height: 12, launchVy: -13.0, color: '#38bdf8' },
    { id: 'bunk-pad-core-r', x: 1326, y: 1188, width: 54, height: 12, launchVy: -13.0, color: '#38bdf8' },
  ],

  refillStations: [
    { id: 'bunk-med-top', x: 1100, y: 280, stationType: 'medkit', cooldownSec: 14 },
    { id: 'bunk-fuel-l', x: 680, y: 1170, stationType: 'fuel', cooldownSec: 10 },
    { id: 'bunk-fuel-r', x: 1520, y: 1170, stationType: 'fuel', cooldownSec: 10 },
    { id: 'bunk-supply-l', x: 240, y: 710, stationType: 'supply', cooldownSec: 16 },
    { id: 'bunk-supply-r', x: 1960, y: 710, stationType: 'supply', cooldownSec: 16 },
  ],

  obstacles: [
    // Vault Perimeter
    { id: 'ground', x: 0, y: 1200, width: 2200, height: 100, color: '#26313f', type: 'ground' },
    { id: 'ceiling', x: 0, y: 0, width: 2200, height: 45, color: '#26313f', type: 'ground' },
    { id: 'wall-left', x: 0, y: 0, width: 45, height: 1300, color: '#26313f', type: 'wall' },
    { id: 'wall-right', x: 2155, y: 0, width: 45, height: 1300, color: '#26313f', type: 'wall' },

    // Central Monolithic Bunker Pillar
    {
      id: 'bunker-pillar',
      x: 1040,
      y: 720,
      width: 120,
      height: 480,
      color: '#374151',
      type: 'wall',
    },

    // Symmetrical Reinforced Bunker Roofs / Floors
    {
      id: 'bunker-roof-left',
      x: 480,
      y: 720,
      width: 560,
      height: 24,
      color: '#4b5563',
      type: 'platform',
    },
    {
      id: 'bunker-roof-right',
      x: 1160,
      y: 720,
      width: 560,
      height: 24,
      color: '#4b5563',
      type: 'platform',
    },

    // Upper Catwalks & Sniper Perches
    {
      id: 'bunker-catwalk-l',
      x: 680,
      y: 360,
      width: 240,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },
    {
      id: 'bunker-catwalk-r',
      x: 1280,
      y: 360,
      width: 240,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },
    {
      id: 'bunker-sky-bridge',
      x: 980,
      y: 310,
      width: 240,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },

    // Base Lofts
    {
      id: 'bunker-base-loft-l',
      x: 120,
      y: 760,
      width: 200,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },
    {
      id: 'bunker-base-loft-r',
      x: 1880,
      y: 760,
      width: 200,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },
  ],

  terrainShapes: [
    // Concrete Pillar Chamfered Deflector Buttresses
    {
      kind: 'polygon',
      id: 'bunk-buttress-l',
      type: 'ground',
      style: 'deflector',
      color: '#374151',
      trimColor: '#f59e0b',
      points: [
        { x: 1040, y: 1060 },
        { x: 1040, y: 1200 },
        { x: 930, y: 1200 },
      ],
    },
    {
      kind: 'polygon',
      id: 'bunk-buttress-r',
      type: 'ground',
      style: 'deflector',
      color: '#374151',
      trimColor: '#f59e0b',
      points: [
        { x: 1160, y: 1060 },
        { x: 1270, y: 1200 },
        { x: 1160, y: 1200 },
      ],
    },
  ],
};
