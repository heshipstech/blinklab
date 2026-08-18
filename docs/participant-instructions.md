# What to do, for the blinklab validation round

Copy this into the email. It is written for someone who has never seen
the page and will not read a second paragraph if the first one is dull.

Everything below is deliberately shaped by what went wrong in the
rehearsal on 16 and 17 August, when the owner ran the same protocol on
his own three devices. He got the order wrong once, and one session's
measurement was spoiled by moving about during the first thirty seconds.
If the person who wrote the protocol can do both of those, a stranger
certainly can.

---

## The email

Thanks for doing this. It takes about four minutes and you need a
webcam. Nothing you record leaves your own machine except two small
spreadsheet files that you choose to send me, and there is no video in
them, only numbers.

Open **https://heshipstech.github.io/blinklab/** and allow the camera
when it asks.

**Before you start, two things that will save you doing it twice:**

- **On a phone, turn auto-lock off first.** Settings, Display and
  Brightness, Auto-Lock, Never. There is a full minute near the end
  where you are not touching the screen, and if it locks the recording
  stops and the session is wasted. Turn it back afterwards.
- **Sit the way you normally sit, and stay there.** You do not need to
  hold still like a photograph. Just do not lean in, lean out, or raise
  your eyebrows during the first thirty seconds, because that is when it
  is learning what your eyes look like open.

**Then do exactly this, in this order. The order matters more than
anything else here.**

1. Press **Start camera**. Answer the sleepiness question it asks.
2. Sit and look at the screen for **30 seconds**. Blink normally.
3. Press **Mark this moment**.
4. Blink **10 times**, deliberately, counting them out loud. Ordinary
   firm blinks, not hard squeezes. Take about a second between each.
5. Press **Mark this moment** again.
6. Close your eyes for about **5 seconds**, then open them.
7. Read something on the screen for about **a minute**.
8. Press **Export CSV**. It will ask the sleepiness question again.
   **Answer it, or no file is saved.** Then save the file.
9. Press **Export blink log** and save that file too.
10. Email me **both** files.

**The ten blinks between the two Marks are the whole point.** They have
to happen after the first Mark and before the second one. If you blink
ten times and then press Mark, or press both Marks and blink afterwards,
the session tells me nothing.

**If something goes wrong, tell me rather than redoing it quietly.** A
session that went sideways is often more useful to me than a clean one,
and if I do not know it went sideways I will read it as a result. Things
worth mentioning: you lost count, the screen locked, you switched
windows or apps, someone interrupted you, or the page looked stuck.

**If you only get one file**, send it anyway and say so. The blink file
is only written when the page thinks it saw at least one blink, so its
absence is itself something I need to know about.

---

## What is in the files, so you can say so if asked

One row per second of numbers about your eyelids, plus a header block
naming your camera, your browser, your screen size and your processor
count. No video, no images, no name, no email address, and no identifier
that follows you between websites.

They stay on the owner's machine. What gets published is a summary table
with the camera model in it, because comparing devices is the point, and
no user agent strings.

---

## Notes for the sender, not for the participant

- **Send to two people first, not six.** You can only ask each person
  once, and the rehearsal changed these instructions twice.
- Ask them to say which device they used, in the email. The files record
  the camera but not whether the phone was propped or handheld.
- Do not tell them what the instrument is expected to do. They are
  ground truth; a person who knows the page is supposed to find ten
  blinks may unconsciously blink harder.
- The files go in `$DATASETS/validation-round`, which is a different
  folder from `validation-dry-run`. Mixing them silently produces one
  table with nine rows and no way to tell whose is whose.
