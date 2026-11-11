# Opstelling

A small PWA for making rowing lineups (HCL8, DCL8, DCL4*) and copying them as a WhatsApp message.

No build step or dependencies: just static files.

## Rowers and settings

Rowers are listed per team in `TEAMS` at the top of `app.js`: edit those lists to add or remove someone.
`stroke` sets the side of the slag seat (HCL8: BB, DCL8: SB); the side in the message always follows the seat.
Ergo and voorbespreken are computed from bootnat (`ERGO_BEFORE`, `VOOR_BEFORE`). The entry code is `PASSCODE`.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish (GitHub Pages)

1. Push to GitHub.
2. Repo → Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open the URL on your iPhone in Safari → Share → **Add to Home Screen**.

After changing files, bump `CACHE` in `sw.js` so phones pick up the new version.
