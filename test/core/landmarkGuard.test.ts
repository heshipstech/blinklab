import { describe, expect, it } from "vitest";

import { LANDMARK_COUNT } from "../../src/core/constants";
import {
  landmarkValidationMessage,
  validateLandmarkCount,
} from "../../src/core/landmarkGuard";
import { face468, faceWithCount } from "../fixtures/face468";

describe("validateLandmarkCount", () => {
  it("rejects the 468 point fixture from the iris-less model variant", () => {
    expect(validateLandmarkCount(face468.length)).toEqual({
      kind: "wrongCount",
      got: 468,
      expected: LANDMARK_COUNT,
    });
  });

  it("accepts exactly 478", () => {
    expect(validateLandmarkCount(faceWithCount(478).length)).toEqual({
      kind: "valid",
    });
  });

  it("rejects one below and one above the expected count", () => {
    expect(validateLandmarkCount(477)).toMatchObject({ kind: "wrongCount" });
    expect(validateLandmarkCount(479)).toMatchObject({ kind: "wrongCount" });
  });
});

describe("landmarkValidationMessage", () => {
  it("stays silent for a valid count", () => {
    expect(landmarkValidationMessage({ kind: "valid" })).toBe("");
  });

  it("names both numbers so the reader can see the mismatch", () => {
    const message = landmarkValidationMessage({
      kind: "wrongCount",
      got: 468,
      expected: 478,
    });
    expect(message).toContain("468");
    expect(message).toContain("478");
    expect(message.length).toBeGreaterThan(40);
  });
});
