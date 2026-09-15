// The cue tone, roadmap 11.0b.
//
// One short beep at every cue boundary. It exists because closed eyes
// cannot read a screen: the two closure instructions end on the ear,
// not on text the person cannot see. Guarded end to end — a page
// without audio (no AudioContext, a policy that blocks it, a muted
// device) still cues on screen, and losing the beep must never lose
// the session.

let context: AudioContext | null = null;

/**
 * One short pulse in the hand at the same boundaries the tone marks
 * (roadmap 11.6b). Phones are where the guided calibration is hardest
 * to follow — the screen is small and often below the face — and a
 * palm can feel "next step" with the eyes shut. navigator.vibrate
 * exists on Android Chrome, is absent on iOS Safari and desktops, and
 * some engines throw without user activation; losing the buzz must
 * never lose the session, the tone's own rule.
 */
export function vibrateCue(): void {
  try {
    navigator.vibrate(100);
  } catch {
    // A still phone still cues on screen and on the ear.
  }
}

export function playCueTone(): void {
  try {
    context ??= new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    // Quiet on purpose: a signal, not a startle.
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch {
    // Screen-only cueing is a complete protocol; the tone is an aid.
  }
}
