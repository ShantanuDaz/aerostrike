import { describe, expect, it } from 'vitest';
import {
  AIM_DEADZONE_DIST,
  AIM_FIRE_PERIMETER_DIST,
  AIM_MAX_DIST,
  MOVE_MAX_DIST,
  STICK_HIT_RADIUS,
  evaluateAimStick,
  evaluateMoveStick,
  pickFixedStickTarget,
} from './touchStickMath';

describe('touchStickMath', () => {
  describe('evaluateMoveStick', () => {
    it('returns neutral output inside center deadzone', () => {
      const res = evaluateMoveStick(2, -4);
      expect(res.moveX).toBe(0);
      expect(res.moveY).toBe(0);
      expect(res.boosting).toBe(false);
    });

    it('clamps knob offset within fixed pad travel and maps horizontal strafe', () => {
      const right = evaluateMoveStick(120, 0);
      expect(right.offsetX).toBeCloseTo(MOVE_MAX_DIST, 5);
      expect(right.offsetY).toBeCloseTo(0, 5);
      expect(right.moveX).toBe(1);
      expect(right.boosting).toBe(false);

      const left = evaluateMoveStick(-30, 0);
      expect(left.moveX).toBeLessThan(0);
      expect(left.moveX).toBeGreaterThan(-1);
    });

    it('triggers jetpack boost when pulling up and drop-through when pushing down', () => {
      const up = evaluateMoveStick(0, -32);
      expect(up.boosting).toBe(true);
      expect(up.moveY).toBe(0);

      const down = evaluateMoveStick(0, 32);
      expect(down.boosting).toBe(false);
      expect(down.moveY).toBe(1);
    });
  });

  describe('evaluateAimStick (perimeter-fire aiming)', () => {
    it('does not update aim inside tiny center deadzone and never shoots', () => {
      const res = evaluateAimStick(AIM_DEADZONE_DIST - 2, 0);
      expect(res.hasAim).toBe(false);
      expect(res.isFiring).toBe(false);
    });

    it('sets aim angle anywhere inside the circle without firing', () => {
      const insideRight = evaluateAimStick(20, 0);
      expect(insideRight.hasAim).toBe(true);
      expect(insideRight.isFiring).toBe(false);
      expect(insideRight.angle).toBeCloseTo(0, 5);

      const nearPerimeter = evaluateAimStick(0, -(AIM_FIRE_PERIMETER_DIST - 1));
      expect(nearPerimeter.hasAim).toBe(true);
      expect(nearPerimeter.isFiring).toBe(false);
      expect(nearPerimeter.angle).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('fires as soon as the joystick reaches the circle perimeter and clamps knob travel', () => {
      const onPerimeter = evaluateAimStick(AIM_FIRE_PERIMETER_DIST, 0);
      expect(onPerimeter.hasAim).toBe(true);
      expect(onPerimeter.isFiring).toBe(true);
      expect(onPerimeter.offsetX).toBeCloseTo(AIM_FIRE_PERIMETER_DIST, 5);

      const beyondPerimeter = evaluateAimStick(-80, 80);
      expect(beyondPerimeter.hasAim).toBe(true);
      expect(beyondPerimeter.isFiring).toBe(true);
      expect(Math.hypot(beyondPerimeter.offsetX, beyondPerimeter.offsetY)).toBeCloseTo(
        AIM_MAX_DIST,
        5,
      );
      expect(beyondPerimeter.angle).toBeCloseTo((3 * Math.PI) / 4, 5);
    });
  });

  describe('pickFixedStickTarget', () => {
    const moveCenter = { x: 80, y: 500 };
    const aimCenter = { x: 820, y: 500 };

    it('assigns touches near fixed pads and ignores touches far outside both pads', () => {
      expect(pickFixedStickTarget(95, 510, moveCenter, aimCenter, false, false)).toBe('move');
      expect(pickFixedStickTarget(805, 485, moveCenter, aimCenter, false, false)).toBe('aim');
      expect(pickFixedStickTarget(450, 300, moveCenter, aimCenter, false, false)).toBeNull();
    });

    it('does not steal an already-active stick and handles narrow screens fairly', () => {
      expect(pickFixedStickTarget(95, 510, moveCenter, aimCenter, true, false)).toBeNull();
      expect(
        pickFixedStickTarget(
          moveCenter.x + STICK_HIT_RADIUS,
          moveCenter.y,
          moveCenter,
          aimCenter,
          false,
          false,
        ),
      ).toBe('move');

      const narrowMove = { x: 75, y: 500 };
      const narrowAim = { x: 225, y: 500 };
      expect(pickFixedStickTarget(120, 500, narrowMove, narrowAim, false, false)).toBe('move');
      expect(pickFixedStickTarget(190, 500, narrowMove, narrowAim, false, false)).toBe('aim');
    });
  });
});
