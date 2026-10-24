# Studio

A small offline studio for writing and charango practice, with a classic-Mac-style desktop. Draggable, resizable windows on tablets and computers; full-screen apps on phones.

## Apps

| App | What it does |
| --- | --- |
| Writer | Distraction-free writing. Projects and documents, saves real `.md` files to a folder (where the browser allows it), optional Google Drive sync, export and import. |
| Metronome | 30-240 BPM, 2-7 beats per bar, accented first beat, tap tempo, volume, optional beat squares. |
| Practice log | Log sessions (date, minutes, what you practiced), 7-day chart, streak, CSV and JSON export, JSON import. |
| Charango | Chord finder for standard tuning (G C E A E). Computes easy fingerings and shows fret diagrams, plus a note map. |

## Open it (pick one)

**A. No hosting: open `studio-single.html`.** This is the whole of Studio in one file. Copy it to your device and open it in the browser (from a file manager, or type its location). It works offline and needs no web address. Limits: it cannot be installed to the home screen, Google Drive sync will not work from a file, and where your data is stored depends on the browser. Some browsers keep nothing, or lose it, for files opened from a file manager, so check once that your writing is still there after closing and reopening the browser, and use the export buttons often.

**B. Host the folder (recommended for Android).** Put all the files on GitHub Pages or Netlify, open the address, then install it:
- Android (Chrome or Opera): menu > Add to Home screen / Install app.
- Windows (Chrome or Edge): the install icon in the address bar.
This gives the sturdier storage, offline use after the first visit, automatic updates, and Google Drive sync.

**C. On a computer, locally:** open a terminal in this folder and run `python3 -m http.server 8000`, then open `http://localhost:8000`.

Do not open `index.html` straight from a file manager: it loads other files and will not find them. (It now says so on screen.)

After adding or changing an app, run `python3 tools/build_single.py` to refresh `studio-single.html`.

## Using the desktop

- Tap an icon in the Studio window to open an app. Opening an open app brings it to the front.
- Drag a window by its title bar. Drag the box in the bottom-right corner to resize. The box at the right of the title bar zooms to full size; the box at the left closes it.
- Window menu: Zoom, Tile left, Tile right, Cascade, Close, and a list of open windows. On e-ink screens use these instead of dragging, because dragging redraws a lot.
- Studio menu: themes (Classic, E-ink plain, Paper, Amber), "Full-screen windows", Reset layout.
- Screens narrower than 700 px always use full-screen windows. Close an app to go back to the launcher.
- Window positions and open apps are remembered per device.

## Hosting on GitHub (resources)

Studio is static files only: about 150 KB in total, no server and no database. GitHub Pages is enough, and the free plan needs a public repository. GitHub's published guidance (check it, it changes): sites should stay under about 1 GB, and bandwidth is around 100 GB a month. One person using this will use a tiny fraction of that.

Public means anyone with the link can open an empty copy of the app. Your writing, practice log, and Drive access never go there; they stay on your device (and in your own Drive, if you connect it).

## Adding an app

1. Make a folder `apps/yourapp/` with an `index.html`. In its `<head>` add:
   `<link rel="stylesheet" href="../../core/theme.css">` and, before your script, `<script src="../../core/app.js"></script>`.
2. That gives your app the studio theme and a small storage helper: `Studio.get(key, default)`, `Studio.set(key, value)`, `Studio.del(key)`, `Studio.download(name, text, type)`. Use your own key prefix, such as `yourapp.settings`.
3. Add one line to `apps.json`:
   `{ "id": "yourapp", "name": "Your app", "icon": "folder", "entry": "apps/yourapp/index.html", "w": 380, "h": 460 }`
   Icons available: pencil, metronome, chart, charango, plus, folder (more can be added in `core/shell.js`).
4. Raise `"version"` in `apps.json` (for example 1.0.2), run `python3 tools/build_single.py` if you use the single file, and upload the files again.

Anyone with the app open sees an "Update ready: reload" button in the menu bar after a few minutes. The app loads the newest files whenever you are online and falls back to the saved copy when you are offline.

## Google Drive sync (whole Studio)

Studio menu > Google Drive. One sign-in covers every app: Writer documents, the practice log, tempo and chord finder settings. It needs the hosted version (a web address), not the single file. Full setup is in `STUDIO-DRIVE-SETUP.md`.

## Known limits (please read)

- **Tested:** in headless Chromium: opening, dragging, resizing, zooming, tiling and closing windows; layout memory; themes reaching every app; offline start; phone-width mode; the update button (simulated); every app's main functions; the metronome's beats land exactly 0.25 s apart on the audio clock at 240 BPM; every chord shape contains only chord tones.
- **Single file:** tested by opening it from a file path in Chromium (all apps, reload, storage). Not tested from an Android file manager in Opera, which is where the first version failed. If it opens but forgets your data, use option B.
- **Drive sync:** tested end to end against a simulated Drive with two devices (connect, merge, deletes, Writer documents with the window open and closed, expired sign-in, disconnect). Not tested against a real Google account, so expect to fix a setup detail on first connect.
- **Not tested:** a real e-ink tablet, touch dragging, Opera mobile, real speakers (I cannot hear the metronome click), a real microphone (there is no tuner yet), a real Google account, and the Windows folder prompt.
- **Writer inside a window:** its folder saving was tested standalone, not from inside a window. Chrome should allow it from a same-site frame, but if choosing a save folder fails there, tell me. (Google sign-in is handled by Studio, not Writer.)
- **Separate storage:** Studio keeps its data in this site's own browser storage. If you used the earlier standalone Writer at another address, that data does not carry over; export a backup there and import it here.
- **Fonts:** the retro look uses your system's monospace font. A pixel font could not be bundled from this workspace.
- **Apps do not link to each other** yet (by design, for now).
- **Charango shapes** are computed from the standard tuning G C E A E, not copied from a chord book, so a shape you know may rank differently. The list shows the four easiest by position and finger spread.
