# Manual test script

A numbered checklist for anything that needs real eyes. Run the relevant items before merging a UI change, and the whole list before every phase tag.

1. (0.2) Run `npm run dev`, open the printed local URL. The page shows the word "blinklab" and the browser tab title reads "blinklab". No errors in the browser console.
2. (1.1, tightened by the fix for #22) Click "Start camera". The browser asks for camera permission. Allow it: your own face appears as live video within a second or two, with natural proportions matching what FaceTime shows. The button disappears once video runs.
3. (1.2) Reload the page and click "Start camera" again, this time deny the permission. A full sentence appears explaining that permission was denied and how to allow it again in browser settings. The page does not go blank, the button stays available, and the console shows no uncaught error.
4. (1.3) The "Frames per second" line shows a steady number near your screen's refresh rate, usually 60 or 120. Drag-resize the window vigorously: the number dips, then recovers within about two seconds.
5. (1.4) Start the camera. The live picture looks identical to item 2, same proportions, updates live, no flicker. Proof it is now our drawing: right-click the picture, the menu offers image options ("Save Image As..."), not video playback controls.
6. (1.5) With more than one camera available (an iPhone via Continuity counts): after starting, a dropdown lists the cameras by name, and choosing another one switches the picture within a second or two. With a single camera, no dropdown appears at all.
7. (1.6) With the camera running, the Mirror box is ticked by default and the picture behaves like a bathroom mirror: lean to your left, your image leans to the same side of the screen. Untick it: the picture flips horizontally. The "Camera resolution" line states the real capture size, for example 1280 x 720, and matches what the picker's chosen camera delivers.
8. (2.1) Open the browser console (View, Developer, JavaScript Console), start the camera, sit in frame: within a few seconds the console prints "face detected: true". Cover the camera with a hand: "face detected: false". Uncover: "true" again. The lines appear only on change, not sixty times a second. The network tab shows no requests to any google domain.
