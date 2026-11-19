-- Supabase 대시보드의 SQL Editor에서 실행하세요. 여러 번 실행해도 안전합니다.

-- 학습 기록
create table if not exists public.study_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('word', 'expression', 'chat', 'journal')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_records
  drop constraint if exists study_records_data_size;
alter table public.study_records
  add constraint study_records_data_size check (pg_column_size(data) <= 65536);

create index if not exists study_records_user_created_idx
  on public.study_records (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_records_touch on public.study_records;
create trigger study_records_touch
  before update on public.study_records
  for each row execute function public.touch_updated_at();

alter table public.study_records enable row level security;

drop policy if exists "read own records" on public.study_records;
create policy "read own records" on public.study_records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own records" on public.study_records;
create policy "insert own records" on public.study_records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own records" on public.study_records;
create policy "update own records" on public.study_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delete own records" on public.study_records;
create policy "delete own records" on public.study_records
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 회원 탈퇴. 기록은 외래 키의 on delete cascade로 함께 지워진다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 앱 오류 보고(src/lib/errorLog.js). 사용자 기록 내용은 넣지 않고 오류 메시지와 환경만 받는다.
-- 앱에서는 넣기만 하고, 읽기는 Supabase 대시보드에서만 한다(select 정책 없음).
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null check (char_length(source) <= 20),
  message text not null check (char_length(message) <= 300),
  stack text not null default '' check (char_length(stack) <= 800),
  page text not null default '' check (char_length(page) <= 40),
  version text not null default '' check (char_length(version) <= 20),
  platform text not null check (platform in ('web', 'android')),
  online boolean not null default true,
  count integer not null default 1 check (count between 1 and 10000)
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists "insert own errors" on public.client_errors;
create policy "insert own errors" on public.client_errors
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- 문제 신고와 관리자 ----------
-- 관리자: Supabase 대시보드의 SQL Editor에서 직접 넣는다.
--   insert into public.admins (user_id) values ('관리자 계정의 user id');
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- 정책이 없으므로 앱에서는 이 표를 읽거나 바꿀 수 없다. 관리자인지는 아래 함수로만 묻는다.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 사용자가 보낸 문제 신고·의견. 본인은 자기 신고와 답변을 보고, 관리자는 모두 보고 상태와 답변을 고친다.
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('bug', 'content', 'idea')),
  message text not null check (char_length(message) between 1 and 2000),
  page text not null default '' check (char_length(page) <= 40),
  version text not null default '' check (char_length(version) <= 20),
  platform text not null check (platform in ('web', 'android')),
  error_log text not null default '' check (char_length(error_log) <= 6000),
  status text not null default 'new' check (status in ('new', 'checking', 'fixed', 'wontfix')),
  admin_reply text not null default '' check (char_length(admin_reply) <= 2000)
);

create index if not exists reports_created_idx on public.reports (created_at desc);

drop trigger if exists reports_touch on public.reports;
create trigger reports_touch
  before update on public.reports
  for each row execute function public.touch_updated_at();

alter table public.reports enable row level security;

drop policy if exists "insert own reports" on public.reports;
create policy "insert own reports" on public.reports
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new' and admin_reply = '');

drop policy if exists "read own or all as admin" on public.reports;
create policy "read own or all as admin" on public.reports
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 관리자는 앱 오류 보고(client_errors)도 읽을 수 있다.
drop policy if exists "admins read errors" on public.client_errors;
create policy "admins read errors" on public.client_errors
  for select to authenticated using ((select public.is_admin()));
