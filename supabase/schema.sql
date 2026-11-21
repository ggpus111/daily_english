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

-- 꾸러미(단어 600, 표현 400) 내용 고치기. 앱에 든 src/data/*.json 위에 덮어쓴다.
-- 신고로 받은 틀린 뜻·예문을 관리자가 앱 업데이트 없이 바로 고치고, 맞지 않는 항목은 숨긴다.
-- 빈 칸(null)은 원래 값을 그대로 쓴다. 누구나(로그인 안 한 사람도) 읽고, 관리자만 고친다.
create table if not exists public.pack_fixes (
  item_id text primary key check (char_length(item_id) between 1 and 40),
  kind text not null check (kind in ('words', 'expressions')),
  meaning text check (char_length(meaning) <= 200),
  example text check (char_length(example) <= 300),
  example_ko text check (char_length(example_ko) <= 300),
  tip text check (char_length(tip) <= 300),
  hidden boolean not null default false,
  note text not null default '' check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

drop trigger if exists pack_fixes_touch on public.pack_fixes;
create trigger pack_fixes_touch
  before update on public.pack_fixes
  for each row execute function public.touch_updated_at();

alter table public.pack_fixes enable row level security;

drop policy if exists "anyone reads pack fixes" on public.pack_fixes;
create policy "anyone reads pack fixes" on public.pack_fixes
  for select to anon, authenticated using (true);

drop policy if exists "admins write pack fixes" on public.pack_fixes;
create policy "admins write pack fixes" on public.pack_fixes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.pack_fixes to anon, authenticated;
grant insert, update, delete on public.pack_fixes to authenticated;

-- ---------- 웹 알림(브라우저를 닫아도 오는 알림) ----------
-- 웹은 탭이 닫히면 앱이 알림을 보낼 수 없어서, 앱이 계획한 알림(src/lib/reminders.js)을 서버 대기열에 올리고
-- 서버 함수(supabase/functions/send-reminders)가 10분마다 보낼 때가 된 것을 웹 푸시로 보낸다.
-- 로그인하고 알림을 켠 웹 사용자만 해당한다. 안드로이드 앱은 휴대폰 안에서 예약해서 쓰지 않는다.

-- 브라우저가 준 푸시 주소와 암호화 키. 알림을 받을 브라우저마다 한 줄.
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 보낼 알림. 앱이 기록이나 알림 설정이 바뀔 때마다 앞으로의 줄을 지우고 다시 넣는다.
create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  send_at timestamptz not null,
  kind text not null check (kind in ('goal', 'review')),
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 200),
  url text not null default '/' check (char_length(url) <= 40)
);

create index if not exists push_queue_send_idx on public.push_queue (send_at);

alter table public.push_queue enable row level security;

drop policy if exists "own push queue" on public.push_queue;
create policy "own push queue" on public.push_queue
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
