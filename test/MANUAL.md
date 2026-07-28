# Manual test script

A numbered checklist for anything that needs real eyes. Run the relevant items before merging a UI change, and the whole list before every phase tag.

1. (0.2) Run `npm run dev`, open the printed local URL. The page shows the word "blinklab" and the browser tab title reads "blinklab". No errors in the browser console.
2. (1.1) Click "Start camera". The browser asks for camera permission. Allow it: your own face appears as live video within a second or two. The button disappears once video runs.
3. (1.1) Reload the page and click "Start camera" again, this time deny the permission. A plain text message appears under the button. The page does not go blank and the console shows no uncaught error. (Proper readable states arrive at 1.2.)
