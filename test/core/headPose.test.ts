import { describe, expect, it } from "vitest";

import { eulerFromMatrix } from "../../src/core/headPose";

// The test builds rotation matrices by multiplying the three base
// rotations numerically, an independent code path from the
// decomposition it checks. Convention matches the synthetic
// generator: roll about z, pitch about x, yaw about y, roll applied
// first, so M = Ry * Rx * Rz.
type M3 = number[][];

function rz(deg: number): M3 {
  const r = (deg * Math.PI) / 180;
  return [
    [Math.cos(r), -Math.sin(r), 0],
    [Math.sin(r), Math.cos(r), 0],
    [0, 0, 1],
  ];
}

function rx(deg: number): M3 {
  const r = (deg * Math.PI) / 180;
  return [
    [1, 0, 0],
    [0, Math.cos(r), -Math.sin(r)],
    [0, Math.sin(r), Math.cos(r)],
  ];
}

function ry(deg: number): M3 {
  const r = (deg * Math.PI) / 180;
  return [
    [Math.cos(r), 0, Math.sin(r)],
    [0, 1, 0],
    [-Math.sin(r), 0, Math.cos(r)],
  ];
}

function mul(a: M3, b: M3): M3 {
  return a.map((row, i) =>
    row.map((_, j) =>
      (a[i] ?? []).reduce(
        (sum, _v, k) => sum + (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0),
        0,
      ),
    ),
  );
}

function asData(pitchDeg: number, yawDeg: number, rollDeg: number): number[] {
  const m = mul(ry(yawDeg), mul(rx(pitchDeg), rz(rollDeg)));
  const data = new Array<number>(16).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      data[r * 4 + c] = m[r]?.[c] ?? 0;
    }
  }
  data[15] = 1;
  return data;
}

describe("eulerFromMatrix, one axis at a time", () => {
  it("recovers a pure roll and nothing else", () => {
    const pose = eulerFromMatrix(asData(0, 0, 15));
    expect(pose).not.toBeNull();
    if (pose !== null) {
      expect(pose.rollDeg).toBeCloseTo(15, 6);
      expect(pose.pitchDeg).toBeCloseTo(0, 6);
      expect(pose.yawDeg).toBeCloseTo(0, 6);
    }
  });

  it("recovers a pure pitch and nothing else", () => {
    const pose = eulerFromMatrix(asData(10, 0, 0));
    expect(pose).not.toBeNull();
    if (pose !== null) {
      expect(pose.pitchDeg).toBeCloseTo(10, 6);
      expect(pose.yawDeg).toBeCloseTo(0, 6);
      expect(pose.rollDeg).toBeCloseTo(0, 6);
    }
  });

  it("recovers a pure yaw and nothing else", () => {
    const pose = eulerFromMatrix(asData(0, 20, 0));
    expect(pose).not.toBeNull();
    if (pose !== null) {
      expect(pose.yawDeg).toBeCloseTo(20, 6);
      expect(pose.pitchDeg).toBeCloseTo(0, 6);
      expect(pose.rollDeg).toBeCloseTo(0, 6);
    }
  });
});

describe("eulerFromMatrix, edges", () => {
  it("recovers all three from a combined rotation", () => {
    const pose = eulerFromMatrix(asData(10, 20, 15));
    expect(pose).not.toBeNull();
    if (pose !== null) {
      expect(pose.pitchDeg).toBeCloseTo(10, 6);
      expect(pose.yawDeg).toBeCloseTo(20, 6);
      expect(pose.rollDeg).toBeCloseTo(15, 6);
    }
  });

  it("reads the identity as all zeros", () => {
    const pose = eulerFromMatrix(asData(0, 0, 0));
    expect(pose).not.toBeNull();
    if (pose !== null) {
      expect(pose.pitchDeg).toBeCloseTo(0, 10);
      expect(pose.yawDeg).toBeCloseTo(0, 10);
      expect(pose.rollDeg).toBeCloseTo(0, 10);
    }
  });

  it("refuses gimbal lock and wrong sized input", () => {
    expect(eulerFromMatrix(asData(90, 0, 0))).toBeNull();
    expect(eulerFromMatrix([1, 0, 0])).toBeNull();
  });
});
