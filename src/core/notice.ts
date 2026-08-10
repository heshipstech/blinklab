// The permanent notice. PROJECT.md's non-goals have said since day
// one that this is not a medical device, not a safety product and
// not for clinical or workplace use. Until now that lived in a
// document nobody opens and a parenthetical beside one number.
//
// The text is a tested constant rather than three copies in three
// files, because a disclaimer that drifts between the page, the
// README and an export is three different promises. Anyone rewording
// it has to change it here, where the test states what it must say.
//
// The last sentence changed on 2026-08-10. It used to deny that
// anything at all left the device, which was false. The August 2026
// audit measured a POST to
// odml.pa.googleapis.com sixty seconds after the face model loads,
// from inside the vendored MediaPipe bundle, needing no detections.
// No video, image, landmark or measurement is in it. The claim was
// still false as written, so it says less and says it truthfully.
// See ADR-0004.
export const DEMO_NOTICE =
  "Demo, not a safety or medical device. " +
  "It is not for clinical, workplace or safety use, its numbers are not " +
  "diagnostic, and it has not been validated against any medical standard. " +
  "Your video and your measurements never leave your browser. The face " +
  "model this page bundles does send anonymous usage statistics to Google.";

export function demoNoticeText(): string {
  return DEMO_NOTICE;
}

// The short form, for standing beside the score. It is a separate
// tested constant rather than a substring of the long one, because the
// two say different amounts and a substring would break silently the
// moment anyone rewords the sentence it was cut from.
//
// It must still carry the two claims that matter most: this is a demo,
// and it is not a medical device. Everything else can live in the full
// notice at the top of the page, which is always visible anyway.
export const DEMO_NOTICE_SHORT =
  "Demo, not a safety or medical device. Not diagnostic.";

export function demoNoticeShort(): string {
  return DEMO_NOTICE_SHORT;
}
