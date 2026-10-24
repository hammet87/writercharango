# Google Drive sync for the whole Studio

Drive sync needs Studio to be opened from a web address (https, or http://localhost on a computer). It cannot work from `studio-single.html` or from a file opened in a file manager, because Google will not sign you in to a page that has no address.

## What syncs

| What | Where it goes in your Drive |
| --- | --- |
| Writer documents (as `.md` files, one folder per project) | `Writer` folder |
| Practice log, metronome tempo and settings, chord finder settings, and anything a future app saves with `Studio.set` | `Studio` folder, one small `.json` file per item |

Studio asks only for the `drive.file` permission, so it can see only files it created itself, never the rest of your Drive.

## Setup (once, about 15 minutes)

### 1. Get a web address

Easiest free option, GitHub Pages:
1. Make a free account at github.com and create a new public repository (for example `studio`).
2. Choose Add file > Upload files, and upload everything from the unzipped `studio` folder (the files and the `core` and `apps` folders, with the folders kept intact).
3. Settings > Pages > deploy from the `main` branch. After a minute your address is `https://YOURNAME.github.io/studio/`.

### 2. Get a Google client ID

1. Go to console.cloud.google.com and create a project (for example "Studio").
2. APIs and Services > Library > search Google Drive API > Enable.
3. OAuth consent screen (or Google Auth Platform) > External > enter an app name and your email > add your own Google account under Test users.
4. Credentials > Create credentials > OAuth client ID > Web application. Under Authorized JavaScript origins add your site's origin with no path: `https://YOURNAME.github.io`. (On a computer you can also add `http://localhost:8000`.) Create it and copy the client ID, which ends in `.apps.googleusercontent.com`.

The client ID is not a secret. Never create or share a client secret or API key for this; Studio does not need either.

### 3. Connect each device

1. Open your Studio address and install it (Add to Home screen on Android).
2. Studio menu > Google Drive.
3. Paste the client ID and tap Connect and sync. Google shows an "unverified app" warning because the project is in test mode; tap Advanced, then Continue, and allow access.
4. Do the same on every device, with the same Google account.

## How it behaves

- Everything saves on the device first, so writing never waits for the network. Sync runs on launch, about 15 seconds after you change something, and when you choose Studio > Sync now. The menu bar shows the status ("Drive: Synced 9:20 AM").
- Practice sessions are merged, not overwritten: if two devices each log a session, both end up with both. A deleted session is deleted everywhere.
- For settings (tempo, chord finder choices) the most recent change wins.
- Writer: if two devices edit the same document, the newer edit wins and the other version is kept as a document named "... (conflict ...)".
- Google sign-in lasts about an hour. After that, syncing pauses and the menu bar says "Drive: Sign in to sync". Open Studio > Google Drive and tap Sign in and sync. This is a Google rule for sites like this one.
- Studio > Google Drive > Disconnect stops syncing on that device. Your files stay in Drive.
- Devices decide "newer" by their own clocks, so keep automatic date and time on.

## If something goes wrong

- "redirect_uri_mismatch" or a blocked sign-in: the address in step 2.4 does not exactly match the address you opened (check https, and no trailing slash or path).
- "Access blocked: app not verified" with no Continue option: your Google account is not listed under Test users.
- Sign-in window does not appear: your browser blocked the pop-up. Allow pop-ups for the site and try again.
