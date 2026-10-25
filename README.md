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

`public/_redirects` provides the SPA fallback. No custom backend server is required. A manifest supports standalone presentation on compatible browsers; offline writes and a full offline PWA are not implemented.

## Backups and limitations

- CSV exports include the selected month's search/category-filtered records. Printable reports can be saved as PDF through the browser print dialog.
- For full backups, export `tracker_data` from Supabase along with a database dump using Supabase's database backup workflow. CSV reports do not preserve category settings or budgets.
- Hosted authentication, ownership policies, and concurrent cloud saves require validation against a real Supabase project before relying on cloud mode. No cloud project or public deployment is created automatically.
- Login supports account creation and sign-in; password reset, receipts, recurring expenses, and offline synchronization are future improvements.
