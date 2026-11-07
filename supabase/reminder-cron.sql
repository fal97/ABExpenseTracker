-- First create Vault secrets named pocket_project_url and pocket_reminder_cron_secret
-- in Supabase Dashboard. Use your project URL and REMINDER_CRON_SECRET respectively.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('pocket-daily-reminders', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pocket_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'pocket_reminder_cron_secret')),
    body := '{}'::jsonb
  );
$$);
