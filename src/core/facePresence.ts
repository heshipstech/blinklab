// Structural shape of what the landmarker returns. core defines its own
// view of the world instead of importing the vendor's types.
export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
};

export type LandmarkerResultLike = {
  faceLandmarks: readonly (readonly LandmarkPoint[])[];
};

export function isFacePresent(result: LandmarkerResultLike): boolean {
  const firstFace = result.faceLandmarks[0];
  return firstFace !== undefined && firstFace.length > 0;
}
