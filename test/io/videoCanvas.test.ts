import { describe, expect, it } from "vitest";

import { readVideoPixels } from "../../src/io/videoCanvas";

// Roadmap 13.8c's per-tick residue: the pupil read used to draw the
// WHOLE camera frame into its offscreen canvas and then read back a
// box a few dozen pixels wide — about eight megabytes of drawing to
// look at a few kilobytes, twice a second, the September audit's
// "draws more than it needs" finding at its clearest. These tests
// pin the fixed shape: only the source rect is drawn, into a canvas
// sized to the box, and the read happens at the origin.

type DrawCall = number[];

function fakeContext(canvas: { width: number; height: number }): {
  context: CanvasRenderingContext2D;
  drawCalls: DrawCall[];
  readCalls: number[][];
} {
  const drawCalls: DrawCall[] = [];
  const readCalls: number[][] = [];
  const context = {
    canvas,
    setTransform: () => undefined,
    drawImage: (...args: unknown[]) => {
      drawCalls.push(args.slice(1) as DrawCall);
    },
    getImageData: (x: number, y: number, w: number, h: number) => {
      readCalls.push([x, y, w, h]);
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    drawCalls,
    readCalls,
  };
}

function fakeVideo(width: number, height: number): HTMLVideoElement {
  return { videoWidth: width, videoHeight: height } as HTMLVideoElement;
}

describe("readVideoPixels draws only the source rect", () => {
  it("copies the box from the video and nothing around it", () => {
    const canvas = { width: 0, height: 0 };
    const { context, drawCalls, readCalls } = fakeContext(canvas);
    const result = readVideoPixels(context, fakeVideo(1920, 1080), {
      x: 600,
      y: 400,
      width: 90,
      height: 60,
    });
    expect(result).not.toBeNull();
    // The nine-argument form: source rect at the box, destination at
    // the origin, both box-sized. A whole-frame draw would start
    // 0, 0, 1920, 1080 and redden here.
    expect(drawCalls).toEqual([[600, 400, 90, 60, 0, 0, 90, 60]]);
    expect(readCalls).toEqual([[0, 0, 90, 60]]);
  });

  it("sizes the canvas to the box, not to the camera", () => {
    const canvas = { width: 0, height: 0 };
    const { context } = fakeContext(canvas);
    readVideoPixels(context, fakeVideo(1920, 1080), {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(50);
  });

  it("still refuses a box that leaves the frame", () => {
    const { context, drawCalls } = fakeContext({ width: 0, height: 0 });
    const result = readVideoPixels(context, fakeVideo(640, 480), {
      x: 600,
      y: 400,
      width: 90,
      height: 90,
    });
    expect(result).toBeNull();
    expect(drawCalls).toEqual([]);
  });

  it("still refuses a video with no frame yet", () => {
    const { context, drawCalls } = fakeContext({ width: 0, height: 0 });
    const result = readVideoPixels(context, fakeVideo(0, 0), {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(result).toBeNull();
    expect(drawCalls).toEqual([]);
  });
});
