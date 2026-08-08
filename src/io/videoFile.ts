import type { CameraFrameSize } from "./camera";

// A recorded clip as a frame source, so a dataset video runs through
// exactly the same pipeline as the live camera. Same video element,
// same landmarker, same measurements. Only the clock differs, and that
// lives in core/frameClock.
//
// The object URL is a document-lifetime reference to the file. It has
// to be revoked by hand or the whole clip stays in memory, which for a
// ten minute recording is not a rounding error.

export type LoadedVideoFile = CameraFrameSize & {
  name: string;
  durationSeconds: number;
};

let currentObjectUrl: string | null = null;

/**
 * Point the video element at a local file and wait until it can report
 * its own dimensions.
 *
 * Resolving on `loadedmetadata` rather than on `play` matters: the
 * caller needs width, height and duration, and those are the things
 * metadata carries. Waiting for playback instead would resolve later
 * and tell us no more.
 */
export async function loadVideoFile(
  video: HTMLVideoElement,
  file: File,
): Promise<LoadedVideoFile> {
  unloadVideoFile(video);

  const url = URL.createObjectURL(file);
  currentObjectUrl = url;
  video.srcObject = null;
  // Safari will not fetch a video's data until something asks for it,
  // and a stepped run never plays, so every seek stalled waiting for
  // bytes that were never requested. The owner's first Safari run
  // measured zero frames because of this. "auto" says fetch it now.
  video.preload = "auto";
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    function onLoaded(): void {
      cleanup();
      resolve();
    }
    function onError(): void {
      cleanup();
      // The browser will not say why. What a user needs to know is
      // that this particular file is not one this browser can decode,
      // which is a different problem from a broken app.
      reject(
        new Error(
          `This browser could not decode ${file.name}. Try an MP4 or WebM file.`,
        ),
      );
    }
    function cleanup(): void {
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    }
    // canplay rather than loadedmetadata: metadata gives dimensions
    // and duration, but a stepped run needs actual frame data, and
    // starting to seek before any exists is what stalled Safari.
    video.addEventListener("canplay", onLoaded);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });

  // Deliberately NOT played here. The landmarker takes seconds to
  // download and initialise, and a clip playing during that wait loses
  // its opening seconds with no way to get them back. A live camera
  // can afford it because the person keeps sitting there. A recording
  // cannot: the head of the data is simply gone, and the exported CSV
  // is short at the start with nothing saying why. The caller starts
  // playback once the model is ready.
  return {
    widthPx: video.videoWidth,
    heightPx: video.videoHeight,
    name: file.name,
    // A clip whose duration the container does not record reads
    // Infinity. Reporting 0 would be a lie; the caller decides what an
    // unknown duration means to it.
    durationSeconds: video.duration,
  };
}

/**
 * Release the clip and the memory behind it.
 *
 * Safe to call when nothing is loaded, because stopping is something
 * callers do on every source change and should not have to guard.
 */
export function unloadVideoFile(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (currentObjectUrl !== null) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}
