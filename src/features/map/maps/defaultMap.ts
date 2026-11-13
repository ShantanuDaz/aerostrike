import type { GameMap } from '../types';

export const defaultMap: GameMap = {
  id: 'training-ground',
  name: 'Training Grounds (CTF 2000x1200)',
  width: 2000,
  height: 1200,
  backgroundColor: '#1a1f26',
  theme: 'training_deck',

  baseBlue: {
    x: 80,
    y: 780,
    width: 240,
    height: 260,
  },

  baseRed: {
    x: 1680,
    y: 780,
    width: 240,
    height: 260,
  },

  flagBlue: {
    x: 200,
    y: 920,
  },

  flagRed: {
    x: 1800,
    y: 920,
  },

  spawnPointsBlue: [
    { x: 140, y: 920 },
    { x: 260, y: 920 },
    { x: 200, y: 680 },
  ],

  spawnPointsRed: [
    { x: 1860, y: 920 },
    { x: 1740, y: 920 },
    { x: 1800, y: 680 },
  ],

  weaponSpawns: [
    { id: 'train-mid-rocket', x: 1000, y: 560, weaponType: 'rocket' },
    { id: 'train-top-sniper-l', x: 620, y: 320, weaponType: 'sniper' },
    { id: 'train-top-sniper-r', x: 1380, y: 320, weaponType: 'sniper' },
    { id: 'train-low-shotgun-l', x: 680, y: 980, weaponType: 'shotgun' },
    { id: 'train-low-shotgun-r', x: 1320, y: 980, weaponType: 'shotgun' },
    { id: 'train-deck-rifle-l', x: 420, y: 640, weaponType: 'rifle' },
    { id: 'train-deck-rifle-r', x: 1580, y: 640, weaponType: 'rifle' },
  ],

  bouncePads: [
    { id: 'def-pad-left', x: 520, y: 1088, width: 56, height: 12, launchVy: -12.5, color: '#22d3ee' },
    { id: 'def-pad-right', x: 1424, y: 1088, width: 56, height: 12, launchVy: -12.5, color: '#22d3ee' },
    { id: 'def-pad-mid-l', x: 840, y: 788, width: 52, height: 12, launchVy: -11.8, color: '#38bdf8' },
    { id: 'def-pad-mid-r', x: 1108, y: 788, width: 52, height: 12, launchVy: -11.8, color: '#38bdf8' },
  ],

  refillStations: [
    { id: 'def-supply-mid', x: 1000, y: 280, stationType: 'supply', cooldownSec: 16 },
    { id: 'def-med-left', x: 320, y: 670, stationType: 'medkit', cooldownSec: 14 },
    { id: 'def-med-right', x: 1680, y: 670, stationType: 'medkit', cooldownSec: 14 },
    { id: 'def-fuel-low-l', x: 680, y: 1070, stationType: 'fuel', cooldownSec: 10 },
    { id: 'def-fuel-low-r', x: 1320, y: 1070, stationType: 'fuel', cooldownSec: 10 },
  ],

  obstacles: [
    {
      id: 'ground',
      x: 0,
      y: 1100,
      width: 2000,
      height: 100,
      color: '#2d3748',
      type: 'ground',
    },
    {
      id: 'ceiling',
      x: 0,
      y: 0,
      width: 2000,
      height: 40,
      color: '#2d3748',
      type: 'ground',
    },
    {
      id: 'wall-left',
      x: 0,
      y: 0,
      width: 40,
      height: 1200,
      color: '#2d3748',
      type: 'wall',
    },
    {
      id: 'wall-right',
      x: 1960,
      y: 0,
      width: 40,
      height: 1200,
      color: '#2d3748',
      type: 'wall',
    },
    // Base Defense Lofts
    {
      id: 'plat-base-l',
      x: 120,
      y: 700,
      width: 180,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    {
      id: 'plat-base-r',
      x: 1700,
      y: 700,
      width: 180,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    // Mid Flank Corridors
    {
      id: 'plat-mid-l',
      x: 380,
      y: 660,
      width: 240,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    {
      id: 'plat-mid-r',
      x: 1380,
      y: 660,
      width: 240,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    // Upper Sniper Perches
    {
      id: 'plat-sky-l',
      x: 550,
      y: 340,
      width: 220,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    {
      id: 'plat-sky-r',
      x: 1230,
      y: 340,
      width: 220,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    // Mid Contested Platform & Upper Apex
    {
      id: 'plat-center',
      x: 880,
      y: 580,
      width: 240,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
    {
      id: 'plat-apex',
      x: 920,
      y: 300,
      width: 160,
      height: 18,
      color: '#4a5568',
      type: 'platform',
    },
  ],

  terrainShapes: [
    // Symmetrical Curved Training Speed-Ramps
    {
      kind: 'spline_floor',
      id: 'def-curve-left',
      type: 'ground',
      style: 'alloy',
      color: '#2d3748',
      trimColor: '#38bdf8',
      bottomY: 1100,
      samples: 14,
      topPoints: [
        { x: 740, y: 1100 },
        { x: 810, y: 1040 },
        { x: 880, y: 1100 },
      ],
    },
    {
      kind: 'spline_floor',
      id: 'def-curve-right',
      type: 'ground',
      style: 'alloy',
      color: '#2d3748',
      trimColor: '#38bdf8',
      bottomY: 1100,
      samples: 14,
      topPoints: [
        { x: 1120, y: 1100 },
        { x: 1190, y: 1040 },
        { x: 1260, y: 1100 },
      ],
    },
  ],
};
