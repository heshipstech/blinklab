import type { LandmarkPoint } from "../../src/core/facePresence";

// A face as the OLDER iris-less model variant would report it:
// 468 landmarks, no points 468 to 477.
export function faceWithCount(count: number): LandmarkPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (i % 100) / 100,
    y: Math.floor(i / 100) / 100,
    z: 0,
  }));
}

export const face468: readonly LandmarkPoint[] = faceWithCount(468);
