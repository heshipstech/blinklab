# Manual test script

A numbered checklist for anything that needs real eyes. Run the relevant items before merging a UI change, and the whole list before every phase tag.

1. (0.2) Run `npm run dev`, open the printed local URL. The page shows the word "blinklab" and the browser tab title reads "blinklab". No errors in the browser console.
2. (1.1) Click "Start camera". The browser asks for camera permission. Allow it: your own face appears as live video within a second or two. The button disappears once video runs.
3. (1.2) Reload the page and click "Start camera" again, this time deny the permission. A full sentence appears explaining that permission was denied and how to allow it again in browser settings. The page does not go blank, the button stays available, and the console shows no uncaught error.
