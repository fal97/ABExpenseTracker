# Pocket — monthly expense tracker

A responsive React + TypeScript app for personal expense tracking. Includes expense creation/editing/deletion, custom categories, monthly budgets, category breakdowns, daily and six-month charts, previous-month comparisons, search/filtering, CSV export, and printable reports.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Without Supabase environment variables, records are saved in this browser's local storage. They do not sync to another browser/device and clearing browser data removes them. Export CSV regularly. No sample expenses are mixed into personal records.

```sh
npm run build
node --experimental-strip-types --test tests/model.test.mjs
```

## Enable cloud login and storage

1. Create a Supabase project and run `supabase/schema.sql` once in its SQL editor.
2. Copy `.env.example` to `.env.local`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and public publishable/anon key. Never use a secret/service-role key in this app.
4. In Supabase Authentication, enable email/password login and set the Site URL to your deployed app URL. Add localhost as a redirect URL during development.
5. Restart Vite. Create an account, confirm your email if required, then sign in.

Cloud mode starts with a separate account dataset. Existing browser-local expenses are not automatically uploaded. Cloud records are loaded when signing in or reloading; reload on the other device to see recent changes. Concurrent edits are rejected and the latest dataset is loaded before retrying, rather than silently overwriting another device's changes.

## Architecture

Browser → React UI → Supabase Auth + PostgREST → PostgreSQL with row-level security.

The first implementation stores one JSON document per user in `tracker_data`, including expenses, categories, budgets, and currency. This simplifies atomic persistence for a small personal dataset. It differs from the initial normalized-table proposal: reporting is computed in the browser and amounts are rounded/summed as integer cents. Migrate to separate expense/category/budget tables and server-side aggregates if the app grows beyond personal use. Updates include the loaded `updated_at` value as an optimistic concurrency check.

The frontend contains only the public Supabase key. PostgreSQL row-level policies enforce account ownership for every operation. Categories are archived so historical expenses retain their category. Currency is fixed after recording expenses to prevent relabeling existing values. Expense dates are local calendar dates, avoiding timezone shifts in monthly totals.

## Deploy to Cloudflare Pages

1. Push this project to a GitHub repository.
2. Create a Cloudflare Pages project connected to it.
3. Set build command to `npm run build` and output directory to `dist`.
4. Use Node.js 22.19 or newer.
5. Add both `VITE_SUPABASE_*` variables to the build environment before deploying. These variables are compiled into the frontend; rebuild when changing them.
6. Update Supabase Auth Site URL to the resulting HTTPS URL.

`public/_redirects` provides the SPA fallback. A manifest supports standalone presentation on compatible browsers. The service worker handles push notifications; offline writes and offline page caching are not implemented.

## Daily push reminders

Settings includes per-account, per-device daily reminders (default 20:00 in the device's time zone). Users choose a time and IANA time zone and can disable the reminder. Reminders continue after closing Pocket or signing out; turn them off in Settings before signing out if desired. iPhone/iPad users need iOS/iPadOS 16.4+, must add Pocket to the Home Screen and open that icon, then tap Enable daily reminder and allow notifications.

Server setup is required before notifications can be delivered:

1. Run `supabase/reminders.sql` in your Supabase SQL editor.
2. Generate VAPID keys with `npx web-push generate-vapid-keys --json`. Keep the private key secret and retain the same key pair across deployments.
3. Set `VITE_VAPID_PUBLIC_KEY` to the public key in the frontend build environment.
4. Set Supabase Edge Function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a real `mailto:` contact), and `REMINDER_CRON_SECRET` (a long random secret). The function uses the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never put the service role or private key in Vite variables.
5. Deploy with `supabase functions deploy send-reminders`. `supabase/config.toml` disables JWT verification for this cron endpoint; it authenticates every request using `x-cron-secret` instead.
6. In Supabase Vault, create `pocket_project_url` with your project URL and `pocket_reminder_cron_secret` with the same cron secret. Run `supabase/reminder-cron.sql` once to schedule delivery every minute. See [Supabase's scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
7. Rebuild/deploy the frontend, enable a reminder on the phone, set its time a few minutes ahead, close Pocket, and verify the lock-screen notification. Tap it to reopen Pocket, then verify Turn off reminder prevents the next delivery.

The sender uses each saved time zone, catches up later the same day after missed cron runs, claims up to 100 due subscriptions per minute, retries transient failures after five minutes, and removes expired subscriptions. Delivery may be delayed by connectivity, Focus, or push-provider availability. A crash after sending but before recording success can cause a retry; notifications use a stable tag to replace the previous daily alert. Neither notification content nor worker caching contains expense records. Live delivery, database policies, and the Edge runtime must be verified on the hosted project; local worker tests do not verify Apple's push service.

Run worker tests with `node --test tests/reminders.test.mjs`.

## Backups and limitations

- CSV exports include the selected month's search/category-filtered records. Printable reports can be saved as PDF through the browser print dialog.
- For full backups, export `tracker_data` from Supabase along with a database dump using Supabase's database backup workflow. CSV reports do not preserve category settings or budgets.
- Hosted authentication, ownership policies, and concurrent cloud saves require validation against a real Supabase project before relying on cloud mode. No cloud project or public deployment is created automatically.
- Login supports account creation and sign-in; password reset, receipts, recurring expenses, and offline synchronization are future improvements.
