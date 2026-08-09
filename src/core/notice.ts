// The permanent notice. PROJECT.md's non-goals have said since day
// one that this is not a medical device, not a safety product and
// not for clinical or workplace use. Until now that lived in a
// document nobody opens and a parenthetical beside one number.
//
// The text is a tested constant rather than three copies in three
// files, because a disclaimer that drifts between the page, the
// README and an export is three different promises. Anyone rewording
// it has to change it here, where the test states what it must say.
export const DEMO_NOTICE =
  "Demo, not a safety or medical device. " +
  "It is not for clinical, workplace or safety use, its numbers are not " +
  "diagnostic, and it has not been validated against any medical standard. " +
  "All processing happens in your browser and no data leaves your device.";

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
