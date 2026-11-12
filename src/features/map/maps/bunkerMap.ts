import type { GameMap } from '../types';

export const bunkerMap: GameMap = {
  id: 'bunker',
  name: 'Underground Bunker',
  width: 900,
  height: 600,
  backgroundColor: '#14181d',
  theme: 'bunker_vault',
  baseBlue: { x: 40, y: 440, width: 140, height: 120 },
  baseRed: { x: 720, y: 440, width: 140, height: 120 },
  flagBlue: { x: 90, y: 480 },
  flagRed: { x: 810, y: 480 },
  spawnPointsBlue: [{ x: 80, y: 500 }],
  spawnPointsRed: [{ x: 820, y: 500 }],
  weaponSpawns: [
    { id: 'bunk-shotgun', x: 280, y: 320, weaponType: 'shotgun' },
    { id: 'bunk-rocket', x: 600, y: 320, weaponType: 'rocket' },
  ],
  bouncePads: [
    { id: 'bunk-pad-left', x: 185, y: 548, width: 52, height: 12, launchVy: -11.5, color: '#22d3ee' },
    { id: 'bunk-pad-right', x: 663, y: 548, width: 52, height: 12, launchVy: -11.5, color: '#22d3ee' },
  ],
  refillStations: [
    { id: 'bunk-med-top', x: 450, y: 320, stationType: 'medkit', cooldownSec: 14 },
    { id: 'bunk-fuel-left', x: 320, y: 530, stationType: 'fuel', cooldownSec: 10 },
    { id: 'bunk-fuel-right', x: 580, y: 530, stationType: 'fuel', cooldownSec: 10 },
  ],
  obstacles: [
    {
      id: 'ground',
      x: 0,
      y: 560,
      width: 900,
      height: 40,
      color: '#26313f',
      type: 'ground',
    },
    {
      id: 'bunker-pillar',
      x: 410,
      y: 350,
      width: 80,
      height: 210,
      color: '#374151',
      type: 'wall',
    },
    {
      id: 'bunker-roof-left',
      x: 200,
      y: 350,
      width: 210,
      height: 20,
      color: '#4b5563',
      type: 'platform',
    },
    {
      id: 'bunker-roof-right',
      x: 490,
      y: 350,
      width: 210,
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
        { x: 410, y: 505 },
        { x: 410, y: 560 },
        { x: 350, y: 560 },
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
        { x: 490, y: 505 },
        { x: 550, y: 560 },
        { x: 490, y: 560 },
      ],
    },
    // Reinforced Vault Ceiling Curve
    {
      kind: 'spline_floor',
      id: 'bunk-vault-ceiling',
      type: 'wall',
      style: 'alloy',
      color: '#2a3545',
      trimColor: '#f59e0b',
      samples: 20,
      topPoints: [
        { x: 160, y: 0 },
        { x: 450, y: 0 },
        { x: 740, y: 0 },
      ],
      bottomPoints: [
        { x: 160, y: 42 },
        { x: 450, y: 112 },
        { x: 740, y: 42 },
      ],
    },
  ],
};
