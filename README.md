# Gym Log

An offline-first workout logger made for a four-day Upper / Lower routine.

## Features
- Upper A, Lower A, Upper B, and Lower B with exact sets and reps
- Per-set kilograms, previous session weights, workout history, and rest timer
- 12-week body-weight, waist, steps, cardio, and strength tracker
- Local JSON export / import to protect your records
- Optional Supabase email/password sign-in and private cloud backup with explicit first upload
- Offline sync queue and server-side revision checks to prevent silent overwrites
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
Offline records are saved in **your device's local browser storage** under `moGymLog.v1`, not inside this GitHub repository. Cloud backup is **optional**. After explicit account sign-in and first upload, snapshots are stored in the dedicated Supabase Gym Log project under per-user Row Level Security. Only a **publishable** Supabase key is embedded in the public browser app; no privileged database keys are used. If you are offline, local recording continues, and changes wait to sync.

Use **Settings → Export JSON backup** regularly and keep the backup in a safe location. A different browser, a new iPhone, clearing website data, or deleting the installed app can erase the on-device records.

## Development
Serve these files from any local HTTP server (e.g., `python -m http.server 8000`) for browser testing. PWA installation and service workers require HTTPS or localhost.

## Deployment status

The GitHub Pages deployment runs automatically when the `main` branch receives a new commit. Review the **Actions → Deploy Gym Log** workflow to confirm a successful publication before installing the app.

## Private cloud backup setup (enabled)
1. Open **Settings → Secure cloud backup** in Gym Log.
2. Create an account with email and a password (or sign in if you already have an account). Confirm your email if Supabase asks, then return to the same Gym Log app and sign in with your password.
3. On the device containing your existing workouts and measurements, press **Check cloud backup** and **Back up this device**. The first upload requires a confirmation and will **not** overwrite existing cloud data.
4. On any other device, install/open Gym Log, sign into the *same email account*, press **Check cloud backup**, then **Restore cloud to this device**. Export any existing local records before restoring.
5. After the first device pairing, changes sync when online. An updated cloud revision from another device pauses uploading; users must resolve a conflict manually rather than allowing a silent overwrite.
6. Sign-in credentials are sent directly to Supabase Auth. The app does not store passwords in its repository or upload them with workout data.

Supabase project: [Gym Log](https://supabase.com/dashboard/project/zxmuvdjsxhhvzzovdbpa). Database migration: `supabase/migrations/20261011_create_gym_log_snapshots.sql` (applied, with RLS).

**Please keep JSON backups too:** cloud backup is a second layer of protection, not an absolute guarantee against data loss. Uninstalling the Home Screen app or clearing Safari data can remove local storage and the saved login session. Different Safari/PWA contexts may have separate local records, but using the same cloud account can transfer them.
