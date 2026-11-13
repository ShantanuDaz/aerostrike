export interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

export interface CollisionResult {
  hit: boolean;
  time: number; // 0..1 fraction of movement completed before collision
  normal: [number, number, number];
}

/**
 * Checks if two static AABBs intersect.
 */
export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min[0] < b.max[0] &&
    a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] &&
    a.max[1] > b.min[1] &&
    a.min[2] < b.max[2] &&
    a.max[2] > b.min[2]
  );
}

/**
 * Continuous Swept AABB test of moving box against a static box.
 * Returns time of collision (0..1) and collision normal if collision occurs within delta.
 */
export function sweptAABB(
  box: AABB,
  delta: [number, number, number],
  obstacle: AABB,
): CollisionResult {
  // If moving box is completely disjoint on an axis where it has ZERO movement delta,
  // then no collision can ever occur during this sweep!
  for (let i = 0; i < 3; i++) {
    if (delta[i] === 0) {
      if (box.max[i] <= obstacle.min[i] || box.min[i] >= obstacle.max[i]) {
        return { hit: false, time: 1.0, normal: [0, 0, 0] };
      }
    }
  }

  const invEntry: [number, number, number] = [0, 0, 0];
  const invExit: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    if (delta[i] > 0) {
      invEntry[i] = obstacle.min[i] - box.max[i];
      invExit[i] = obstacle.max[i] - box.min[i];
    } else {
      invEntry[i] = obstacle.max[i] - box.min[i];
      invExit[i] = obstacle.min[i] - box.max[i];
    }
  }

  const entry: [number, number, number] = [0, 0, 0];
  const exit: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    if (delta[i] === 0) {
      entry[i] = -Infinity;
      exit[i] = Infinity;
    } else {
      entry[i] = invEntry[i] / delta[i];
      exit[i] = invExit[i] / delta[i];
    }
  }

  const entryTime = Math.max(entry[0], entry[1], entry[2]);
  const exitTime = Math.min(exit[0], exit[1], exit[2]);

  // If no collision occurred or collision occurred outside range [0, 1]
  if (
    entryTime > exitTime ||
    (entry[0] < 0 && entry[1] < 0 && entry[2] < 0) ||
    entry[0] > 1 ||
    entry[1] > 1 ||
    entry[2] > 1
  ) {
    return { hit: false, time: 1.0, normal: [0, 0, 0] };
  }

  // Determine surface normal of collision
  const normal: [number, number, number] = [0, 0, 0];
  if (entry[0] >= entry[1] && entry[0] >= entry[2]) {
    normal[0] = delta[0] < 0 ? 1 : -1;
  } else if (entry[1] >= entry[0] && entry[1] >= entry[2]) {
    normal[1] = delta[1] < 0 ? 1 : -1;
  } else {
    normal[2] = delta[2] < 0 ? 1 : -1;
  }

  return { hit: true, time: Math.max(0, entryTime), normal };
}
