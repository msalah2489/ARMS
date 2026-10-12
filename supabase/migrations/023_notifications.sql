-- =============================================================================
-- ARMS: in-app notifications (broadcast / role / user) + read receipts
-- =============================================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
-- Notifications are never deleted by the app; reads are tracked separately.
-- =============================================================================

create table if not exists public.app_notifications (
  id text primary key,
  title text not null,
  body text not null,
  audience_type text not null check (audience_type in ('all', 'role', 'user')),
  audience_role text,
  audience_user_id text,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

comment on table public.app_notifications is 'رسائل داخل النظام — لا تُحذف من التطبيق';
comment on column public.app_notifications.audience_type is 'all | role | user';

create table if not exists public.app_notification_reads (
  id text primary key,
  notification_id text not null,
  user_id text not null,
  read_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

comment on table public.app_notification_reads is 'حالة القراءة لكل مستخدم (بدون حذف الرسالة)';

create index if not exists app_notifications_created_at_idx
  on public.app_notifications (created_at desc);

create index if not exists app_notification_reads_user_idx
  on public.app_notification_reads (user_id);

create index if not exists app_notification_reads_notification_idx
  on public.app_notification_reads (notification_id);

alter table public.app_notifications enable row level security;
alter table public.app_notification_reads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications' and policyname = 'public read app_notifications'
  ) then
    create policy "public read app_notifications"
      on public.app_notifications for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications' and policyname = 'public write app_notifications'
  ) then
    create policy "public write app_notifications"
      on public.app_notifications for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notification_reads' and policyname = 'public read app_notification_reads'
  ) then
    create policy "public read app_notification_reads"
      on public.app_notification_reads for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notification_reads' and policyname = 'public write app_notification_reads'
  ) then
    create policy "public write app_notification_reads"
      on public.app_notification_reads for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.app_notifications to anon, authenticated;
grant select, insert, update, delete on public.app_notification_reads to anon, authenticated;
