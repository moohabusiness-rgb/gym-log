# Gym Log

An offline-first workout logger made for a four-day Upper / Lower routine.

## Features
- Upper A, Lower A, Upper B, and Lower B with exact sets and reps
- Per-set kilograms, previous session weights, workout history, and rest timer
- 12-week body-weight, waist, steps, cardio, and strength tracker
- Local JSON export / import to protect your records
- Installable iPhone Progressive Web App (PWA), with offline caching after first online load

## Publish with GitHub Pages
1. Open **Settings → Pages** for this repository.
2. Set the **Build and deployment source** to **GitHub Actions**.
3. The `.github/workflows/deploy.yml` workflow will publish the site when deployment is enabled; it also runs on pushes to `main`.
4. For a GitHub Free personal account, **GitHub Pages requires a public repository**. A private repository requires an eligible paid GitHub plan. Repository visibility should only be changed by the owner intentionally.
5. After successful deployment, the project URL will normally be:
   https://moohabusiness-rgb.github.io/gym-log/

## Install on iPhone
Open the **live Pages URL in Safari** (do not open `index.html` directly from Files or inside ChatGPT), tap **Share → Add to Home Screen**, and launch it once while online. The service worker caches the app shell for offline use.

## Privacy & data
This app has no login, backend, analytics, or Supabase connection. Workout history is saved in **your device's local browser storage** under `moGymLog.v1`, not inside this GitHub repository.

Use **Settings → Export JSON backup** regularly and keep the backup in a safe location. A different browser, a new iPhone, clearing website data, or deleting the installed app can erase the on-device records.

## Development
Serve these files from any local HTTP server (e.g., `python -m http.server 8000`) for browser testing. PWA installation and service workers require HTTPS or localhost.
