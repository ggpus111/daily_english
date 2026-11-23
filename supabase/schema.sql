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

-- ---------- 앱 안 AI 일기 교정 ----------
-- 서버 함수 supabase/functions/correct-journal이 Google Gemini(무료 요금제)로 교정을 받아 온다.
-- 무료 한도를 지키고 남용을 막으려고 사용자마다 하루 사용 횟수를 센다. 앱에서는 읽거나 쓸 수 없고(정책 없음),
-- 서버 함수만 service role로 쓴다. 교정 내용 자체는 저장하지 않는다(일기에 붙이는 건 사용자가 저장할 때).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

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
  kind text not null check (kind in ('goal', 'review', 'couple')),
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 200),
  url text not null default '/' check (char_length(url) <= 40)
);

-- 알림을 눌렀을 때 열 주소는 이 앱 안의 경로만 허용한다(바깥 주소로 보내는 알림을 막는다). 이미 만든 데이터베이스에도 더한다.
alter table public.push_queue drop constraint if exists push_queue_url_check;
alter table public.push_queue add constraint push_queue_url_check check (url ~ '^/([^/\\]|$)');

create index if not exists push_queue_send_idx on public.push_queue (send_at);

alter table public.push_queue enable row level security;

drop policy if exists "own push queue" on public.push_queue;
create policy "own push queue" on public.push_queue
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- 연인과 오늘의 한 문장 주고받기 ----------
-- 두 사람이 초대 번호로 짝이 되어, 하루에 한 문장씩 주고받는다. 로그인한 사용자만 쓴다.
-- 짝(couples)은 두 명까지, 한 사람은 한 짝에만 들어간다. 짝이 아닌 사람은 아무것도 읽지 못한다.
-- 짝 만들기·들어가기·나가기는 아래 함수로만 한다(초대 번호 목록을 앱이 읽지 못하게).
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  -- 연인이 문장을 보내면 웹 알림을 받을지, 알림 문구의 언어
  notify boolean not null default false,
  notify_lang text not null default 'ko' check (notify_lang in ('ko', 'en')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table if not exists public.couple_sentences (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  body text not null check (char_length(body) between 1 and 300),
  lang text not null check (char_length(lang) between 2 and 5),
  created_at timestamptz not null default now(),
  unique (couple_id, user_id, day)
);

create or replace function public.is_couple_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members where couple_id = target and user_id = (select auth.uid())
  );
$$;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_sentences enable row level security;

drop policy if exists "members read couple" on public.couples;
create policy "members read couple" on public.couples
  for select to authenticated using (public.is_couple_member(id));

drop policy if exists "members read members" on public.couple_members;
create policy "members read members" on public.couple_members
  for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members read sentences" on public.couple_sentences;
create policy "members read sentences" on public.couple_sentences
  for select to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "members write own sentence" on public.couple_sentences;
create policy "members write own sentence" on public.couple_sentences
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_couple_member(couple_id));

drop policy if exists "members edit own sentence" on public.couple_sentences;
create policy "members edit own sentence" on public.couple_sentences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_couple_member(couple_id));

drop policy if exists "members delete own sentence" on public.couple_sentences;
create policy "members delete own sentence" on public.couple_sentences
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 짝 만들기: 초대 번호(헷갈리는 글자 O, I, 0, 1 제외 6자리)를 새로 만든다.
create or replace function public.create_couple(nick text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'already paired';
  end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into couples (code) values (new_code) returning id into new_id;
      exit;
    exception when unique_violation then
      -- 번호가 겹치면 다시 만든다.
    end;
  end loop;
  insert into couple_members (couple_id, user_id, nickname) values (new_id, auth.uid(), left(trim(nick), 30));
  return new_code;
end;
$$;

-- 초대 번호를 틀린 기록. 함수(security definer)만 쓰고, 앱에서는 직접 읽거나 쓸 수 없다.
create table if not exists public.couple_join_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  failed_at timestamptz not null default now()
);
create index if not exists couple_join_failures_user_idx on public.couple_join_failures (user_id, failed_at);
alter table public.couple_join_failures enable row level security;
revoke all on public.couple_join_failures from anon, authenticated;

-- 짝 들어가기: 초대 번호가 맞고 자리가 남아 있을 때만.
-- 틀린 번호를 기록하려면 오류로 끝내지 않고 결과 글자를 돌려줘야 해서(오류가 나면 기록도 취소된다) 돌려주는 값이 text다.
drop function if exists public.join_couple(text, text);
create or replace function public.join_couple(invite text, nick text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'already paired';
  end if;
  -- 초대 번호를 마구 넣어 보는 것을 막는다: 최근 1시간에 5번 틀리면 잠시 막는다.
  if (select count(*) from couple_join_failures
      where user_id = auth.uid() and failed_at > now() - interval '1 hour') >= 5 then
    return 'too many attempts';
  end if;
  select id into target from couples where code = upper(trim(invite));
  if target is null then
    insert into couple_join_failures (user_id) values (auth.uid());
    return 'invalid code';
  end if;
  if (select count(*) from couple_members where couple_id = target) >= 2 then
    raise exception 'couple full';
  end if;
  insert into couple_members (couple_id, user_id, nickname) values (target, auth.uid(), left(trim(nick), 30));
  return 'ok';
end;
$$;

-- 짝 나가기: 내가 보낸 문장과 내 자리를 지우고, 아무도 안 남으면 짝도 지운다.
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  select couple_id into target from couple_members where user_id = auth.uid();
  if target is null then return; end if;
  delete from couple_sentences where couple_id = target and user_id = auth.uid();
  delete from couple_members where couple_id = target and user_id = auth.uid();
  if not exists (select 1 from couple_members where couple_id = target) then
    delete from couples where id = target;
  end if;
end;
$$;

revoke all on function public.create_couple(text), public.join_couple(text, text), public.leave_couple() from public, anon;
grant execute on function public.create_couple(text), public.join_couple(text, text), public.leave_couple() to authenticated;

-- 이미 만든 데이터베이스를 위한 변경(처음 만드는 경우에는 위 표에 이미 들어 있어서 아무 일도 하지 않는다).
alter table public.couple_members add column if not exists notify boolean not null default false;
alter table public.couple_members add column if not exists notify_lang text not null default 'ko';
alter table public.push_queue drop constraint if exists push_queue_kind_check;
alter table public.push_queue add constraint push_queue_kind_check check (kind in ('goal', 'review', 'couple'));

-- 연인 새 문장 알림 켜기·끄기(내 줄만 바꾼다).
create or replace function public.set_couple_notify(enabled boolean, msg_lang text)
returns void
language sql
security definer
set search_path = public
as $$
  update couple_members
  set notify = enabled, notify_lang = case when msg_lang = 'ko' then 'ko' else 'en' end
  where user_id = auth.uid();
$$;

-- 새 문장이 올라오면, 알림을 켠 상대의 웹 알림 대기열에 넣는다(문장 내용은 알림에 담지 않는다).
-- 보내는 일은 서버 함수 send-reminders가 10분마다 한다. 고쳐 쓴 문장(update)에는 다시 알리지 않는다.
create or replace function public.notify_partner_of_sentence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  for member in
    select user_id, notify_lang from couple_members
    where couple_id = new.couple_id and user_id <> new.user_id and notify
  loop
    insert into push_queue (user_id, send_at, kind, title, body, url)
    values (
      member.user_id,
      now(),
      'couple',
      case when member.notify_lang = 'ko' then '연인의 한 문장이 도착했어요' else 'A sentence from your partner' end,
      case when member.notify_lang = 'ko' then '열어서 읽어 보고 답을 보내 보세요.' else 'Open it, read it, and send one back.' end,
      '/#couple'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists couple_sentence_notify on public.couple_sentences;
create trigger couple_sentence_notify
  after insert on public.couple_sentences
  for each row execute function public.notify_partner_of_sentence();

-- ---------- 연인 문장에 반응 남기기 ----------
-- 상대 문장에 가볍게 반응한다(문장마다 한 사람이 하나, 다시 누르면 지운다). 내 문장에는 달 수 없다.
create table if not exists public.couple_reactions (
  sentence_id bigint not null references public.couple_sentences (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('heart', 'thanks', 'funny', 'learned')),
  created_at timestamptz not null default now(),
  primary key (sentence_id, user_id)
);

alter table public.couple_reactions enable row level security;

drop policy if exists "members read reactions" on public.couple_reactions;
create policy "members read reactions" on public.couple_reactions
  for select to authenticated
  using (exists (
    select 1 from public.couple_sentences s
    where s.id = sentence_id and public.is_couple_member(s.couple_id)
  ));

drop policy if exists "members react to partner" on public.couple_reactions;
create policy "members react to partner" on public.couple_reactions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.couple_sentences s
      where s.id = sentence_id and s.user_id <> (select auth.uid()) and public.is_couple_member(s.couple_id)
    )
  );

drop policy if exists "members change own reaction" on public.couple_reactions;
create policy "members change own reaction" on public.couple_reactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.couple_sentences s
      where s.id = sentence_id and s.user_id <> (select auth.uid()) and public.is_couple_member(s.couple_id)
    )
  );

drop policy if exists "members remove own reaction" on public.couple_reactions;
create policy "members remove own reaction" on public.couple_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 반응이 달리면 문장을 쓴 사람의 알림 대기열에 넣는다(알림을 켠 사람만, 내용은 담지 않는다).
-- 같은 알림이 1시간 안에 이미 있으면 다시 넣지 않아, 눌렀다 취소했다 해도 알림이 쏟아지지 않는다.
create or replace function public.notify_author_of_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author record;
  msg_title text;
begin
  select m.user_id, m.notify_lang into author
  from couple_sentences s
  join couple_members m on m.couple_id = s.couple_id and m.user_id = s.user_id
  where s.id = new.sentence_id and m.notify;
  if author.user_id is null then return new; end if;
  msg_title := case when author.notify_lang = 'ko' then '연인이 내 문장에 반응했어요' else 'Your partner reacted to your sentence' end;
  if exists (
    select 1 from push_queue
    where user_id = author.user_id and kind = 'couple' and title = msg_title and send_at > now() - interval '1 hour'
  ) then
    return new;
  end if;
  insert into push_queue (user_id, send_at, kind, title, body, url)
  values (
    author.user_id,
    now(),
    'couple',
    msg_title,
    case when author.notify_lang = 'ko' then '열어서 확인해 보세요.' else 'Open the app to see it.' end,
    '/#couple'
  );
  return new;
end;
$$;

drop trigger if exists couple_reaction_notify on public.couple_reactions;
create trigger couple_reaction_notify
  after insert or update on public.couple_reactions
  for each row execute function public.notify_author_of_reaction();

revoke all on function public.set_couple_notify(boolean, text) from public, anon;
grant execute on function public.set_couple_notify(boolean, text) to authenticated;
