import { describe, expect, it } from "vitest";

import { cameraOptions, shouldShowPicker } from "../../src/core/deviceList";

describe("cameraOptions", () => {
  it("keeps only video inputs, dropping microphones and speakers", () => {
    const devices = [
      { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
      { kind: "videoinput", deviceId: "cam1", label: "FaceTime HD Camera" },
      { kind: "audiooutput", deviceId: "spk1", label: "Speakers" },
    ];
    expect(cameraOptions(devices)).toEqual([
      { deviceId: "cam1", label: "FaceTime HD Camera" },
    ]);
  });

  it("invents numbered labels when the browser gives blanks", () => {
    const devices = [
      { kind: "videoinput", deviceId: "a", label: "" },
      { kind: "videoinput", deviceId: "b", label: "" },
    ];
    expect(cameraOptions(devices)).toEqual([
      { deviceId: "a", label: "Camera 1" },
      { deviceId: "b", label: "Camera 2" },
    ]);
  });

  it("numbers blanks by camera position, not by raw device position", () => {
    const devices = [
      { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
      { kind: "videoinput", deviceId: "a", label: "" },
    ];
    expect(cameraOptions(devices)).toEqual([
      { deviceId: "a", label: "Camera 1" },
    ]);
  });

  it("returns an empty list for no devices", () => {
    expect(cameraOptions([])).toEqual([]);
  });
});

describe("shouldShowPicker", () => {
  it("hides the picker for zero cameras", () => {
    expect(shouldShowPicker([])).toBe(false);
  });

  it("hides the picker for exactly one camera", () => {
    expect(shouldShowPicker([{ deviceId: "a", label: "Camera 1" }])).toBe(
      false,
    );
  });

  it("shows the picker for two cameras", () => {
    expect(
      shouldShowPicker([
        { deviceId: "a", label: "Camera 1" },
        { deviceId: "b", label: "Camera 2" },
      ]),
    ).toBe(true);
  });
});
