-- انسخ هذا الملف كاملاً إلى Supabase → SQL Editor وشغّله مرة واحدة.
-- ينشئ جدول app_push_subscriptions لحفظ اشتراكات إشعارات المتصفح (Web Push)
-- المرتبطة بحساب كل موظف. آمن لإعادة التشغيل.

create table if not exists public.app_push_subscriptions (
  id text primary key,
  user_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

comment on table public.app_push_subscriptions is
  'اشتراكات Web Push للمتصفح — مرتبطة بحساب الموظف';

create unique index if not exists app_push_subscriptions_endpoint_uidx
  on public.app_push_subscriptions (endpoint);

create index if not exists app_push_subscriptions_user_idx
  on public.app_push_subscriptions (user_id);

alter table public.app_push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_push_subscriptions'
      and policyname = 'public read app_push_subscriptions'
  ) then
    create policy "public read app_push_subscriptions"
      on public.app_push_subscriptions for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_push_subscriptions'
      and policyname = 'public write app_push_subscriptions'
  ) then
    create policy "public write app_push_subscriptions"
      on public.app_push_subscriptions for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.app_push_subscriptions to anon, authenticated;
