// What the export says about itself.
//
// The export button had three outcomes and only one of them was
// visible. It wrote a file, or it opened the sleepiness question and
// returned, or it hit `if (csv === null) return` and did nothing at
// all. Two of those three produced no file, no error and no message,
// which from the outside is indistinguishable from a broken button.
// The owner reported exactly that, and the flow works: the question
// was open and the answer was what the file was waiting for.
//
// The question is a modal now, so it can no longer be missed, and the
// word "below" has gone from the waiting message with it. The message
// stays: a person who clicks Export and answers the question still
// wants to be told the file was written, and by what name.
//
// This is the project's own recurring defect wearing a new coat, so it
// gets the project's usual answer: every path says what happened, out
// loud, including the successful one. A confirmation is not noise here.
// It is what tells six people on six machines that the thing they were
// asked to send actually exists.

/** Shown when the export is waiting on the sleepiness question. */
export const EXPORT_WAITING_FOR_KSS =
  "Almost there: answer the sleepiness question and the file will download.";

/** Shown when there is genuinely nothing to write. */
export const EXPORT_NOTHING_RECORDED =
  "Nothing to export yet: no measurements have been recorded in this session.";

/** Shown when a file was actually handed to the browser. */
export function exportedMessage(filename: string): string {
  return `Exported ${filename}. Check your downloads.`;
}

/** Shown when a blink log was asked for before any blink was seen. */
export const EXPORT_NO_BLINKS =
  "Nothing to export yet: no blinks have been detected in this session.";
