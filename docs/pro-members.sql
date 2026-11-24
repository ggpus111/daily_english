-- ---------- Pro 회원 ----------
-- 결제가 생기기 전까지는 관리자가 이메일로 지정한 계정만 Pro다. Pro는 AI 교정과 대화 도우미를 Claude로 받는다.
-- 본인은 자기 줄만 읽을 수 있고(앱이 Pro 기능을 열지 정함), 지정·해제는 관리자 함수로만 한다.
create table if not exists public.pro_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text check (char_length(note) <= 200),
  granted_at timestamptz not null default now()
);

alter table public.pro_members enable row level security;
drop policy if exists "read own pro" on public.pro_members;
create policy "read own pro" on public.pro_members
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.pro_members to authenticated;

create or replace function public.admin_set_pro(target_email text, enabled boolean, memo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(target_email));
  if target is null then
    raise exception 'no user with that email';
  end if;
  if enabled then
    insert into public.pro_members (user_id, note) values (target, left(memo, 200))
    on conflict (user_id) do update set note = excluded.note;
  else
    delete from public.pro_members where user_id = target;
  end if;
end;
$$;

create or replace function public.admin_list_pro()
returns table (email text, note text, granted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  return query
    select u.email::text, p.note, p.granted_at
    from public.pro_members p join auth.users u on u.id = p.user_id
    order by p.granted_at desc;
end;
$$;

revoke all on function public.admin_set_pro(text, boolean, text) from public, anon;
grant execute on function public.admin_set_pro(text, boolean, text) to authenticated;
revoke all on function public.admin_list_pro() from public, anon;
grant execute on function public.admin_list_pro() to authenticated;
