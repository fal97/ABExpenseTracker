-- Run once in the Supabase SQL editor.
create table public.tracker_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint valid_tracker_data check (
    jsonb_typeof(data->'expenses') = 'array' and
    jsonb_typeof(data->'categories') = 'array' and
    jsonb_typeof(data->'budgets') = 'object' and
    data->>'currency' in ('LKR','USD','EUR','GBP','INR','AUD')
  )
);
alter table public.tracker_data enable row level security;
revoke all on public.tracker_data from anon;
grant select, insert, update, delete on public.tracker_data to authenticated;
create policy "Read own tracker" on public.tracker_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own tracker" on public.tracker_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own tracker" on public.tracker_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own tracker" on public.tracker_data for delete to authenticated using ((select auth.uid()) = user_id);
