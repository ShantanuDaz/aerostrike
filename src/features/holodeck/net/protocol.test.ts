import { describe, expect, it } from 'vitest';
import {
  encodeHolodeckPacket,
  decodeHolodeckPacket,
  HOLODECK_PACKET_BYTES,
  type HolodeckWireState,
} from './holodeckProtocol';
import { RemoteProxyManager } from './remoteProxyManager';

describe('Holodeck 16-Byte WebRTC Binary Protocol', () => {
  it('encodes and decodes with exact 16-byte size and sub-centimeter fidelity', () => {
    const original: HolodeckWireState = {
      seq: 42,
      x: 35.12,
      y: 1.84,
      z: -20.48,
      vx: 4.8,
      vy: -1.2,
      vz: -3.5,
      yaw: 1.57,
      pitch: -0.35,
      inputs: {
        forward: true,
        backward: false,
        left: false,
        right: true,
        jump: false,
        crouch: true,
        sprint: false,
        fire: true,
        plant: false,
        defuse: false,
        reload: false,
        weapon: 'vandal',
        isAlive: true,
        team: 'red',
      },
      health: 85,
      armor: 40,
    };

    const buffer = encodeHolodeckPacket(original);
    expect(buffer.byteLength).toBe(HOLODECK_PACKET_BYTES);
    expect(buffer.byteLength).toBe(16);

    const decoded = decodeHolodeckPacket(buffer);

    expect(decoded.seq).toBe(42);
    expect(decoded.x).toBeCloseTo(original.x, 2);
    expect(decoded.y).toBeCloseTo(original.y, 2);
    expect(decoded.z).toBeCloseTo(original.z, 2);
    expect(decoded.vx).toBeCloseTo(original.vx, 1);
    expect(decoded.vy).toBeCloseTo(original.vy, 1);
    expect(decoded.vz).toBeCloseTo(original.vz, 1);
    expect(decoded.yaw).toBeCloseTo(original.yaw, 1);
    expect(decoded.pitch).toBeCloseTo(original.pitch, 1);

    expect(decoded.inputs.forward).toBe(true);
    expect(decoded.inputs.backward).toBe(false);
    expect(decoded.inputs.right).toBe(true);
    expect(decoded.inputs.crouch).toBe(true);
    expect(decoded.inputs.fire).toBe(true);
    expect(decoded.inputs.weapon).toBe('vandal');
    expect(decoded.inputs.team).toBe('red');
    expect(decoded.inputs.isAlive).toBe(true);

    expect(decoded.health).toBe(85);
    expect(decoded.armor).toBe(40);
  });

  it('interpolates remote player snapshots smoothly', () => {
    const proxy = new RemoteProxyManager();
    const t0 = 1000;
    const t1 = 1100;

    const baseState: HolodeckWireState = {
      seq: 1,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      inputs: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        crouch: false,
        sprint: false,
        fire: false,
        plant: false,
        defuse: false,
        reload: false,
        weapon: 'vandal',
        isAlive: true,
        team: 'blue',
      },
      health: 100,
      armor: 50,
    };

    proxy.pushSnapshot({ ...baseState, x: 0, z: 0 }, t0);
    proxy.pushSnapshot({ ...baseState, x: 10, z: 20 }, t1);

    // Sample exactly in middle (delay 50ms from t1)
    const mid = proxy.getInterpolatedState(50, t1);
    expect(mid).not.toBeNull();
    if (mid) {
      expect(mid.x).toBeCloseTo(5.0, 1);
      expect(mid.z).toBeCloseTo(10.0, 1);
    }
  });
});
