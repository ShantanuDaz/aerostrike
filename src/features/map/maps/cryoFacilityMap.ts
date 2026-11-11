import type { GameMap } from '../types';

export const cryoFacilityMap: GameMap = {
  id: 'cryo-facility',
  name: 'Cryo Reactor (Indoor CTF 2400x1400)',
  width: 2400,
  height: 1400,
  backgroundColor: '#08101c',

  baseBlue: {
    x: 80,
    y: 800,
    width: 280,
    height: 220,
  },

  baseRed: {
    x: 2040,
    y: 800,
    width: 280,
    height: 220,
  },

  flagBlue: {
    x: 210,
    y: 955,
  },

  flagRed: {
    x: 2190,
    y: 955,
  },

  spawnPointsBlue: [
    { x: 140, y: 950 },
    { x: 270, y: 950 },
    { x: 160, y: 675 },
  ],

  spawnPointsRed: [
    { x: 2260, y: 950 },
    { x: 2130, y: 950 },
    { x: 2240, y: 675 },
  ],

  weaponSpawns: [
    { id: 'cryo-mid-rocket', x: 1200, y: 696, weaponType: 'rocket' },
    { id: 'cryo-top-sniper-l', x: 860, y: 316, weaponType: 'sniper' },
    { id: 'cryo-top-sniper-r', x: 1540, y: 316, weaponType: 'sniper' },
    { id: 'cryo-low-shotgun-l', x: 760, y: 1236, weaponType: 'shotgun' },
    { id: 'cryo-low-shotgun-r', x: 1640, y: 1236, weaponType: 'shotgun' },
    { id: 'cryo-deck-rifle-l', x: 640, y: 716, weaponType: 'rifle' },
    { id: 'cryo-deck-rifle-r', x: 1760, y: 716, weaponType: 'rifle' },
  ],

  bouncePads: [
    // Coolant Basement Rapid Lift Vents -> Main Reactor Deck
    { id: 'cryo-pad-shaft-l', x: 560, y: 1328, width: 58, height: 12, launchVy: -14.2, color: '#22d3ee' },
    { id: 'cryo-pad-shaft-r', x: 1782, y: 1328, width: 58, height: 12, launchVy: -14.2, color: '#22d3ee' },
    // Main Deck -> Upper Ventilation Catwalk
    { id: 'cryo-pad-upper-l', x: 770, y: 728, width: 54, height: 12, launchVy: -13.4, color: '#38bdf8' },
    { id: 'cryo-pad-upper-r', x: 1576, y: 728, width: 54, height: 12, launchVy: -13.4, color: '#38bdf8' },
  ],

  refillStations: [
    { id: 'cryo-supply-top', x: 1200, y: 300, stationType: 'supply', cooldownSec: 16 },
    { id: 'cryo-med-low-l', x: 910, y: 1310, stationType: 'medkit', cooldownSec: 14 },
    { id: 'cryo-med-low-r', x: 1490, y: 1310, stationType: 'medkit', cooldownSec: 14 },
    { id: 'cryo-fuel-base-l', x: 290, y: 690, stationType: 'fuel', cooldownSec: 10 },
    { id: 'cryo-fuel-base-r', x: 2110, y: 690, stationType: 'fuel', cooldownSec: 10 },
  ],

  obstacles: [
    // Sealed Reactor Perimeter
    { x: 0, y: 1340, width: 2400, height: 60, color: '#16263b', type: 'ground' },
    { x: 0, y: 0, width: 2400, height: 36, color: '#16263b', type: 'ground' },
    { x: 0, y: 0, width: 40, height: 1400, color: '#16263b', type: 'wall' },
    { x: 2360, y: 0, width: 40, height: 1400, color: '#16263b', type: 'wall' },

    // Blue Flag Fortress (Left)
    { x: 40, y: 1020, width: 360, height: 320, color: '#172e52', type: 'wall' },
    { x: 150, y: 980, width: 120, height: 20, color: '#38bdf8', type: 'platform' },
    { x: 100, y: 720, width: 240, height: 22, color: '#2563eb', type: 'platform' },
    { x: 360, y: 840, width: 34, height: 180, color: '#1d4ed8', type: 'wall' },

    // Red Flag Fortress (Right)
    { x: 2000, y: 1020, width: 360, height: 320, color: '#4d1924', type: 'wall' },
    { x: 2130, y: 980, width: 120, height: 20, color: '#f87171', type: 'platform' },
    { x: 2060, y: 720, width: 240, height: 22, color: '#dc2626', type: 'platform' },
    { x: 2006, y: 840, width: 34, height: 180, color: '#b91c1c', type: 'wall' },

    // Central Coolant Trench Hazard + Low Crossing Bridge
    { x: 1020, y: 1320, width: 360, height: 20, color: '#991b1b', type: 'hazard' },
    { x: 1040, y: 1140, width: 320, height: 22, color: '#334155', type: 'platform' },

    // Flanking Lower Coolant Chambers
    { x: 640, y: 1260, width: 220, height: 20, color: '#334155', type: 'platform' },
    { x: 1540, y: 1260, width: 220, height: 20, color: '#334155', type: 'platform' },

    // Main Reactor Deck (Mid Tier)
    { x: 540, y: 740, width: 320, height: 24, color: '#475569', type: 'platform' },
    { x: 1020, y: 720, width: 360, height: 26, color: '#64748b', type: 'platform' },
    { x: 1540, y: 740, width: 320, height: 24, color: '#475569', type: 'platform' },
    // Reactor Core Pillar Barriers (symmetrical cover around Rocket pad)
    { x: 1050, y: 540, width: 32, height: 180, color: '#1e293b', type: 'wall' },
    { x: 1318, y: 540, width: 32, height: 180, color: '#1e293b', type: 'wall' },

    // Mid Step Connectors
    { x: 890, y: 940, width: 170, height: 20, color: '#475569', type: 'platform' },
    { x: 1340, y: 940, width: 170, height: 20, color: '#475569', type: 'platform' },

    // Upper Ventilation Catwalk (High Tier)
    { x: 460, y: 420, width: 220, height: 20, color: '#64748b', type: 'platform' },
    { x: 760, y: 340, width: 220, height: 22, color: '#94a3b8', type: 'platform' },
    { x: 1070, y: 330, width: 260, height: 22, color: '#cbd5e1', type: 'platform' },
    { x: 1420, y: 340, width: 220, height: 22, color: '#94a3b8', type: 'platform' },
    { x: 1720, y: 420, width: 220, height: 20, color: '#64748b', type: 'platform' },
  ],
};
