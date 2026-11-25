-- ---------- 꾸러미 신고 ----------
-- 사용자가 꾸러미(표현·단어·문법) 항목을 신고하면 그 항목은 바로 모두에게서 숨긴다(pack_fixes.hidden).
-- 신고는 관리자만 읽고, 관리자 페이지에서 되돌리거나(다시 보이기) 확인할 수 있다.
-- 한 사람이 하루에 신고할 수 있는 수를 정해 두어, 한 사람이 꾸러미를 마구 지우지 못하게 한다.
-- supabase/schema.sql 맨 끝에도 같은 내용이 있다(새로 설치할 때). 이미 쓰는 서버는 이 파일만 SQL Editor에서 실행하면 된다.

-- 문법 꾸러미도 고치기·숨기기 대상에 넣는다.
alter table public.pack_fixes drop constraint if exists pack_fixes_kind_check;
alter table public.pack_fixes add constraint pack_fixes_kind_check
  check (kind in ('words', 'expressions', 'grammar'));

create table if not exists public.pack_reports (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) between 1 and 40),
  kind text not null check (kind in ('words', 'expressions', 'grammar')),
  item_text text not null default '' check (char_length(item_text) <= 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('wrong', 'offensive', 'unnatural', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.pack_reports enable row level security;

drop policy if exists "admins read pack reports" on public.pack_reports;
create policy "admins read pack reports" on public.pack_reports
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admins delete pack reports" on public.pack_reports;
create policy "admins delete pack reports" on public.pack_reports
  for delete to authenticated using ((select public.is_admin()));

grant select, delete on public.pack_reports to authenticated;

-- 신고하기: 신고를 남기고 그 항목을 바로 숨긴다. 신고는 이 함수로만 넣는다(표에 직접 넣는 권한은 없다).
create or replace function public.report_pack_item(
  target_item text,
  target_kind text,
  why text,
  memo text default '',
  label text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit constant int := 20;
  today_count int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if target_kind not in ('words', 'expressions', 'grammar') or why not in ('wrong', 'offensive', 'unnatural', 'other')
    or char_length(coalesce(target_item, '')) not between 1 and 40 then
    raise exception 'invalid report';
  end if;
  select count(*) into today_count
  from public.pack_reports
  where user_id = auth.uid() and created_at > now() - interval '1 day';
  if today_count >= daily_limit then
    raise exception 'report limit';
  end if;
  insert into public.pack_reports (item_id, kind, item_text, user_id, reason, note)
  values (target_item, target_kind, left(coalesce(label, ''), 200), auth.uid(), why, left(coalesce(memo, ''), 300))
  on conflict (item_id, user_id) do nothing;
  insert into public.pack_fixes (item_id, kind, hidden, note, updated_by)
  values (target_item, target_kind, true, '신고로 숨김', auth.uid())
  on conflict (item_id) do update set hidden = true;
end;
$$;

revoke all on function public.report_pack_item(text, text, text, text, text) from public, anon;
grant execute on function public.report_pack_item(text, text, text, text, text) to authenticated;
