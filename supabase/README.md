# Supabase cloud backup — implementation notes

This folder contains the database migration for private user backups. **The migration is prepared but not yet applied to a Supabase project.** Until the project is configured, Gym Log remains fully functional offline and does not send workout data to any server.

## Requirements
- A Supabase project selected by the owner.
- Supabase authentication for a recoverable personal account (verified email is recommended; a disposable anonymous identity is **not** sufficient to restore data on a replacement phone).
- Project URL and publishable/anon key, which are designed for browser apps.
- **Never** put Supabase service-role or secret keys in a GitHub Pages project.

## Privacy and database
- One `gym_log_snapshots` JSON document per signed-in user.
- Postgres Row Level Security restricts SELECT, INSERT, UPDATE, DELETE to the authenticated row owner.
- The browser stores temporary data offline. Cloud backup is an additional recovery copy, not a prerequisite to logging workouts.
- Do not upload anything until sign-in succeeds and a snapshot has been retrieved and compared to on-device data.

## Suggested sync behavior (upcoming phase)
1. First login: download cloud snapshot if one exists.
2. If local and cloud both contain records, present a **restore/merge/keep local** choice before any overwrite. Do not silently replace either side.
3. If cloud is empty, offer to back up existing on-device records.
4. After initial pairing, sync changes after a local save and when a network connection becomes available.
5. Show an explicit **last synced at** state. If offline, show **changes saved on this device; waiting to sync**.
6. Persist session credentials in an origin-scoped store; don't infer a signed-in state from email alone.
7. When changing iPhones, sign into the same account and restore the backed-up snapshot before recording new sessions.
8. Consider a non-destructive revision check for multi-device conflicts before automatic cloud writes.

## iPhone note
Safari and Home Screen PWA data storage can be separate. If a record exists in Safari but not in the installed app, export a JSON backup in Safari and import it into the installed app before enabling cloud sync.

## Next step
Connect the Supabase plugin in ChatGPT so the assistant can inspect/select the project, apply the migration, verify RLS policies, and configure the client using only public browser credentials.
