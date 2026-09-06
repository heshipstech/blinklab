import { CALIBRATION_REFUSED_SENTENCE, type BaselineState } from "./baseline";
import type { CameraState } from "./cameraState";
import { BLINK_RISK_FPS, MIN_BLINK_FPS } from "./constants";
import type { RulerFitVerdict } from "./rulerFit";

// The session verdict: assessment pilot increment 3
// (docs/assessment-pilot-plan.md). One pure object assembling the
// per-session refusal surfaces the instrument already computes, each
// a closed status carrying its reason sentence, so a report renders
// what the session decided rather than re-deciding it.
//
// The verdict is DERIVED, NEVER EXPORTED: the export carries only
// primary facts, and the analysis side re-derives this same object
// from the file (a later increment pins the two byte-for-byte). A
// summary that travelled beside its inputs would eventually disagree
// with them.
//
// The vocabulary is the plan's, and the distinctions are
// load-bearing: "refused" means a gate held numbers back, "warned"
// means the numbers stand with a stated risk, "unknown" means the
// page could not find out, "notApplicable" means this session shape
// has no such value — and none of them may ever render as a zero.
// The verdict judges the MEASUREMENT, never the person.

export type SurfaceStatus =
  "ok" | "refused" | "warned" | "unknown" | "notApplicable";

export type SurfaceName =
  | "calibration"
  | "evidenceRate"
  | "interruptions"
  | "rulerFit"
  | "cameraOutcome"
  | "pose"
  | "modelTrust"
  | "markedWindow";

export type SurfaceFinding = {
  surface: SurfaceName;
  status: SurfaceStatus;
  sentence: string;
};

/** The primary facts the verdict is assembled from, all already computed elsewhere. */
export type VerdictInputs = {
  calibration: BaselineState | null;
  cameraOutcome: CameraState;
  /** The measured rate of distinct frames read, where the browser reports it. */
  sampledFps: number | null;
  /** The processing rate, the fallback evidence rate where sampling is unreported. */
  processingFps: number | null;
  visibilityChanges: number;
  /**
   * The protocol's marked window, or null when this session had none.
   * interruptionsInside is null when interruptions occurred but
   * cannot be attributed to a phase — unknown, never silently ok.
   */
  markedWindow: {
    widthSeconds: number;
    interruptionsInside: number | null;
  } | null;
  poseValidFraction: number | null;
  rulerFitShown: RulerFitVerdict | null;
  modelTrusted: boolean;
};

export type SessionVerdict = {
  surfaces: readonly SurfaceFinding[];
  headline: SurfaceStatus;
};

function calibrationFinding(state: BaselineState | null): SurfaceFinding {
  if (state === null || state.kind === "learning") {
    return {
      surface: "calibration",
      status: "unknown",
      sentence:
        "The learning window never froze, so no ruler was born and no refusal fired.",
    };
  }
  if (state.kind === "refused") {
    // The report may not paraphrase the refusal, so the finding IS
    // the test-pinned sentence.
    return {
      surface: "calibration",
      status: "refused",
      sentence: CALIBRATION_REFUSED_SENTENCE,
    };
  }
  return {
    surface: "calibration",
    status: "ok",
    sentence:
      `Calibration accepted: ${String(state.window.sampleCount)} samples, ` +
      `spread ratio ${state.window.spreadRatio.toFixed(3)}, ceiling unbound.`,
  };
}

function evidenceFinding(
  sampledFps: number | null,
  processingFps: number | null,
): SurfaceFinding {
  const rate = sampledFps ?? processingFps;
  const source =
    sampledFps !== null
      ? "the measured rate of distinct frames read"
      : "the processing rate, because this browser does not report delivery";
  if (rate === null) {
    return {
      surface: "evidenceRate",
      status: "unknown",
      sentence: "No evidence rate could be measured for this session.",
    };
  }
  if (rate < MIN_BLINK_FPS) {
    return {
      surface: "evidenceRate",
      status: "refused",
      sentence:
        `The evidence rate was ${rate.toFixed(1)} frames per second ` +
        `(${source}), below the ${String(MIN_BLINK_FPS)} a short blink ` +
        `needs, so temporal blink numbers were withheld rather than guessed.`,
    };
  }
  if (rate < BLINK_RISK_FPS) {
    return {
      surface: "evidenceRate",
      status: "warned",
      sentence:
        `The evidence rate was ${rate.toFixed(1)} frames per second ` +
        `(${source}): quick or shallow blinks can be missed below ` +
        `${String(BLINK_RISK_FPS)}.`,
    };
  }
  return {
    surface: "evidenceRate",
    status: "ok",
    sentence:
      `The evidence rate was ${rate.toFixed(1)} frames per second ` +
      `(${source}), above the ${String(BLINK_RISK_FPS)} risk band.`,
  };
}

function interruptionsFinding(visibilityChanges: number): SurfaceFinding {
  if (visibilityChanges === 0) {
    // Asserted positively, never implied by silence.
    return {
      surface: "interruptions",
      status: "ok",
      sentence: "The page stayed visible throughout the measurement.",
    };
  }
  return {
    surface: "interruptions",
    status: "warned",
    sentence:
      `The page was hidden or the machine slept ` +
      `${String(visibilityChanges)} time(s) during this session; ` +
      `determinism is a claim about an uninterrupted measurement.`,
  };
}

function rulerFitFinding(shown: RulerFitVerdict | null): SurfaceFinding {
  if (shown === null) {
    return {
      surface: "rulerFit",
      status: "unknown",
      sentence:
        "The ruler-fit check had not settled by the end of this session.",
    };
  }
  if (shown === "tooLong") {
    return {
      surface: "rulerFit",
      status: "warned",
      sentence:
        "The ruler measured too long against this session's own resting eye, so blink durations run long.",
    };
  }
  return {
    surface: "rulerFit",
    status: "ok",
    sentence: "The ruler fit this session's own resting eye.",
  };
}

function cameraOutcomeFinding(state: CameraState): SurfaceFinding {
  switch (state.kind) {
    // "ended" is the ordinary end since roadmap 14.0a. "running" and
    // "idle" stay listed because a fixture written before that state
    // existed, and a report drawn mid-run, both name them for the
    // same outcome.
    case "ended":
    case "running":
    case "idle":
      return {
        surface: "cameraOutcome",
        status: "ok",
        sentence: "The session ran and ended without a camera failure.",
      };
    case "requesting":
    case "loadingClip":
      return {
        surface: "cameraOutcome",
        status: "unknown",
        sentence: "The session never finished starting.",
      };
    case "failed":
    case "clipFailed":
    case "measurementFailed":
      return {
        surface: "cameraOutcome",
        status: "refused",
        sentence: `The session ended in a failure: ${state.reason}`,
      };
    case "denied":
      return {
        surface: "cameraOutcome",
        status: "refused",
        sentence: "Camera permission was refused, so nothing was measured.",
      };
    case "noCamera":
      return {
        surface: "cameraOutcome",
        status: "refused",
        sentence: "No camera exists on this device, so nothing was measured.",
      };
    case "modelFailed":
      return {
        surface: "cameraOutcome",
        status: "refused",
        sentence:
          "The measuring model failed to load, so nothing was measured.",
      };
  }
}

function poseFinding(fraction: number | null): SurfaceFinding {
  if (fraction === null) {
    return {
      surface: "pose",
      status: "unknown",
      sentence: "No pose-validity fraction was recorded for this session.",
    };
  }
  // No benchmark of pose-valid fractions exists to choose a line
  // from, and the per-frame gate already refused the invalid frames;
  // the surface states the fraction and judges nothing.
  return {
    surface: "pose",
    status: "ok",
    sentence:
      `Head pose was within the measurement limits for ` +
      `${(fraction * 100).toFixed(0)} percent of frames; frames outside ` +
      `the limits were refused individually as they happened.`,
  };
}

function modelTrustFinding(trusted: boolean): SurfaceFinding {
  if (!trusted) {
    return {
      surface: "modelTrust",
      status: "refused",
      sentence:
        "The face model's output failed its trust checks, and nothing built on it can be trusted either.",
    };
  }
  return {
    surface: "modelTrust",
    status: "ok",
    sentence: "The face model's output passed its trust checks.",
  };
}

function markedWindowFinding(
  window: VerdictInputs["markedWindow"],
  visibilityChanges: number,
): SurfaceFinding {
  if (window === null) {
    return {
      surface: "markedWindow",
      status: "notApplicable",
      sentence:
        "No marked window exists in this session — it did not follow the marked protocol.",
    };
  }
  if (window.widthSeconds === 0) {
    // Round II's rule 5: zero width refuses without needing any
    // benchmark — no time passed, so no count over it means anything.
    return {
      surface: "markedWindow",
      status: "refused",
      sentence:
        "The two marks landed in the same moment, so the window has zero width and cannot be scored.",
    };
  }
  if (window.interruptionsInside === null && visibilityChanges > 0) {
    return {
      surface: "markedWindow",
      status: "unknown",
      sentence:
        "Interruptions occurred but cannot be attributed to a phase, so whether the marked window was disturbed is unknown.",
    };
  }
  if (window.interruptionsInside !== null && window.interruptionsInside > 0) {
    return {
      surface: "markedWindow",
      status: "refused",
      sentence:
        `The page was hidden ${String(window.interruptionsInside)} time(s) ` +
        `inside the marked window, so its ground truth cannot be trusted — ` +
        `declared, not deleted.`,
    };
  }
  return {
    surface: "markedWindow",
    status: "ok",
    sentence: `The marked window spans ${window.widthSeconds.toFixed(1)} seconds, undisturbed.`,
  };
}

// Worst first: a refusal outranks a warning outranks an unknown.
// notApplicable never leads a headline — a surface a session shape
// does not have cannot be the session's verdict.
const HEADLINE_PRECEDENCE: readonly SurfaceStatus[] = [
  "refused",
  "warned",
  "unknown",
];

export function assessSession(inputs: VerdictInputs): SessionVerdict {
  const surfaces: readonly SurfaceFinding[] = [
    calibrationFinding(inputs.calibration),
    evidenceFinding(inputs.sampledFps, inputs.processingFps),
    interruptionsFinding(inputs.visibilityChanges),
    rulerFitFinding(inputs.rulerFitShown),
    cameraOutcomeFinding(inputs.cameraOutcome),
    poseFinding(inputs.poseValidFraction),
    modelTrustFinding(inputs.modelTrusted),
    markedWindowFinding(inputs.markedWindow, inputs.visibilityChanges),
  ];
  const headline =
    HEADLINE_PRECEDENCE.find((status) =>
      surfaces.some((finding) => finding.status === status),
    ) ?? "ok";
  return { surfaces, headline };
}
