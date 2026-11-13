import { describe, expect, it } from 'vitest';
import {
  createSoloBotSquad,
  findCeilingEscapeDirection,
  hasCeilingAbove,
  stepSoloBots,
} from './botAI';
import type { GameMap } from '../map/types';
import type { Flag, Team } from '../ctf/types';
import type { Player } from '../player/types';

function createBotTestMap(): GameMap {
  return {
    id: 'bot-test-map',
    name: 'Bot Test Map',
    width: 1600,
    height: 1000,
    backgroundColor: '#060913',
    baseBlue: { x: 40, y: 700, width: 180, height: 150 },
    baseRed: { x: 1380, y: 700, width: 180, height: 150 },
    flagBlue: { x: 120, y: 830 },
    flagRed: { x: 1480, y: 830 },
    spawnPointsBlue: [{ x: 160, y: 820 }],
    spawnPointsRed: [{ x: 1440, y: 820 }],
    weaponSpawns: [],
    obstacles: [
      { x: 0, y: 860, width: 1600, height: 140, type: 'ground' },
    ],
  };
}

function createFlags(map: GameMap): Record<Team, Flag> {
  return {
    blue: {
      team: 'blue',
      status: 'at_base',
      x: map.flagBlue.x,
      y: map.flagBlue.y,
      baseX: map.flagBlue.x,
      baseY: map.flagBlue.y,
      carrierId: null,
      returnTimer: 0,
    },
    red: {
      team: 'red',
      status: 'at_base',
      x: map.flagRed.x,
      y: map.flagRed.y,
      baseX: map.flagRed.x,
      baseY: map.flagRed.y,
      carrierId: null,
      returnTimer: 0,
    },
  };
}

describe('Solo AI Squad formation, firing, and hazard/CTF reporting', () => {
  it('spawns balanced 1v1, 2v2, and 3v3 squads with difficulty presets', () => {
    const map = createBotTestMap();

    const bots1v1 = createSoloBotSquad(map, 'blue', {
      squadSize: '1v1',
      difficulty: 'cadet',
    });
    expect(bots1v1).toHaveLength(1);
    expect(bots1v1.filter((b) => b.team === 'blue')).toHaveLength(0);
    expect(bots1v1.filter((b) => b.team === 'red')).toHaveLength(1);
    expect(bots1v1[0].difficulty).toBe('cadet');

    const bots2v2 = createSoloBotSquad(map, 'blue');
    expect(bots2v2).toHaveLength(3);
    expect(bots2v2.filter((b) => b.team === 'blue')).toHaveLength(1);
    expect(bots2v2.filter((b) => b.team === 'red')).toHaveLength(2);

    const bots3v3 = createSoloBotSquad(map, 'red', {
      squadSize: '3v3',
      difficulty: 'ace',
    });
    expect(bots3v3).toHaveLength(5);
    expect(bots3v3.filter((b) => b.team === 'red')).toHaveLength(2);
    expect(bots3v3.filter((b) => b.team === 'blue')).toHaveLength(3);
    expect(bots3v3.every((b) => b.difficulty === 'ace')).toBe(true);
  });

  it('detects newly dead bots from hazards, reports dropped flags, and clears lastDamagedBy after respawn', () => {
    const map = createBotTestMap();
    map.obstacles.push({ x: 740, y: 830, width: 120, height: 30, type: 'hazard' });

    const bots = createSoloBotSquad(map, 'blue');
    const redBot = bots.find((b) => b.team === 'red')!;
    redBot.player = {
      ...redBot.player,
      x: 800,
      y: 840,
      carryingFlag: true,
    };
    redBot.lastDamagedBy = {
      dealerId: 'local_1',
      weaponType: 'rocket',
      atMs: 1000,
    };

    const localPlayer: Player = {
      ...bots[0].player,
      id: 'local_1',
      team: 'blue',
      x: 200,
      y: 830,
    };

    const step1 = stepSoloBots({
      bots,
      localPlayer,
      map,
      flags: createFlags(map),
      matchStatus: 'playing',
      pickups: [],
      respawnDelaySec: 0.2,
      nowMs: 1200,
      dt: 1 / 60,
    });

    expect(step1.newlyDeadBots).toHaveLength(1);
    expect(step1.newlyDeadBots[0].bot.id).toBe(redBot.id);
    expect(step1.newlyDeadBots[0].droppedFlagTeam).toBe('blue');
    expect(redBot.player.isDead).toBe(true);

    // Move hazard away from spawn so bot respawns safely and resets lastDamagedBy
    map.obstacles.pop();
    for (let i = 0; i < 15 && redBot.player.isDead; i++) {
      stepSoloBots({
        bots,
        localPlayer,
        map,
        flags: createFlags(map),
        matchStatus: 'playing',
        pickups: [],
        respawnDelaySec: 0.2,
        nowMs: 1500 + i * 50,
        dt: 0.05,
      });
    }

    expect(redBot.player.isDead).toBe(false);
    expect(redBot.lastDamagedBy).toBeNull();
  });

  it('spawns FFA hostile bot packs across presets and lets CTF bots capture when own flag is away', () => {
    const map = createBotTestMap();

    const ffa2 = createSoloBotSquad(map, 'blue', { squadSize: '1v1', mode: 'ffa' });
    expect(ffa2).toHaveLength(1);

    const ffa4 = createSoloBotSquad(map, 'blue', { squadSize: '2v2', mode: 'ffa' });
    expect(ffa4).toHaveLength(3);

    const ffa6 = createSoloBotSquad(map, 'blue', { squadSize: '3v3', mode: 'ffa' });
    expect(ffa6).toHaveLength(5);

    // CTF bot captures enemy flag at home base even when its own flag is stolen/away
    const bots = createSoloBotSquad(map, 'blue', { squadSize: '1v1', mode: 'ctf' });
    const redBot = bots[0];
    redBot.player = {
      ...redBot.player,
      x: map.baseRed.x + map.baseRed.width / 2,
      y: map.baseRed.y + map.baseRed.height / 2,
      carryingFlag: true,
      isDead: false,
    };
    const localPlayer: Player = {
      ...redBot.player,
      id: 'local_1',
      team: 'blue',
      x: 200,
      y: 830,
    };
    const flags = createFlags(map);
    flags.blue.status = 'carried';
    flags.blue.carrierId = redBot.id;
    flags.red.status = 'carried'; // Red's own flag is away!
    flags.red.carrierId = 'local_1';

    const step = stepSoloBots({
      bots,
      localPlayer,
      map,
      flags,
      matchStatus: 'playing',
      pickups: [],
      respawnDelaySec: 3,
      nowMs: 1000,
      dt: 1 / 60,
      mode: 'ctf',
    });

    expect(step.flagEvents).toContainEqual(
      expect.objectContaining({
        action: 'capture',
        team: 'red',
        carrierId: redBot.id,
      }),
    );
  });

  it('detects overhead ceilings, suppresses vertical boost into ceilings, and routes horizontally to the clear edge', () => {
    const map = createBotTestMap();
    // Add an overhead bridge / ceiling above x: 700..900
    map.obstacles.push({ x: 700, y: 740, width: 200, height: 40, type: 'ground' });

    expect(hasCeilingAbove(map, 800, 830)).toBe(true);
    expect(hasCeilingAbove(map, 650, 830)).toBe(false);
    expect(hasCeilingAbove(map, 950, 830)).toBe(false);

    // Escape direction should be non-zero (towards 700 or 900 edge)
    const escapeDir = findCeilingEscapeDirection(map, 800, 830, 0);
    expect(Math.abs(escapeDir)).toBe(1);

    const bots = createSoloBotSquad(map, 'blue', { squadSize: '1v1', mode: 'ffa' });
    const bot = bots[0];
    bot.player = {
      ...bot.player,
      x: 800,
      y: 830,
      isGrounded: true,
      boostFuel: 100,
      fuelOverheated: false,
    };

    // Target is positioned directly above the bot on top of the bridge
    const targetAbove: Player = {
      ...bot.player,
      id: 'target_above',
      team: 'blue',
      x: 800,
      y: 680,
    };

    stepSoloBots({
      bots,
      localPlayer: targetAbove,
      map,
      flags: createFlags(map),
      matchStatus: 'playing',
      pickups: [],
      nowMs: 1000,
      dt: 1 / 60,
      mode: 'ffa',
    });

    // Instead of holding boost into the solid overhead ceiling, the bot suppresses boost and steers horizontally
    expect(bot.input.boosting).toBe(false);
    expect(Math.abs(bot.input.moveX)).toBe(1);
  });
});
