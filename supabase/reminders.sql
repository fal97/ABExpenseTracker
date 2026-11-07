-- Run in the SQL editor after schema.sql.
create table public.push_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) < 4096 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 16 and 100),
  reminder_time time not null default '20:00',
  time_zone text not null default 'Asia/Colombo',
  last_sent_date date,
  claimed_until timestamptz,
  unique (user_id, endpoint)
);
create function public.validate_reminder_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.time_zone) then
    raise exception 'Choose a valid IANA time zone, such as Asia/Colombo';
  end if;
  return new;
end;
$$;
create trigger validate_reminder_zone before insert or update on public.push_reminders
for each row execute function public.validate_reminder_zone();
alter table public.push_reminders enable row level security;
revoke all on public.push_reminders from anon, authenticated;
grant select, delete on public.push_reminders to authenticated;
grant insert (user_id, endpoint, p256dh, auth, reminder_time, time_zone),
  update (user_id, endpoint, p256dh, auth, reminder_time, time_zone) on public.push_reminders to authenticated;
create policy "Own reminders" on public.push_reminders for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Claim atomically so overlapping cron invocations cannot send the same reminder.
create function public.claim_due_reminders() returns setof public.push_reminders
language sql security definer set search_path = '' as $$
  update public.push_reminders set claimed_until = now() + interval '5 minutes'
  where id in (
    select id from public.push_reminders
    where (claimed_until is null or claimed_until < now())
      and (now() at time zone time_zone)::time >= reminder_time
      and last_sent_date is distinct from (now() at time zone time_zone)::date
    order by id limit 100 for update skip locked
  ) returning *;
$$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
